#!/usr/bin/env python3
"""
購買傾向分析・推奨購買数量算出システム
========================================
14日に一度の購買指示タイミングで実行し、次のサイクル（14日間）の
各商品の推奨購買数量を機械学習モデルで算出する。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ モデル選定の根拠
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

採用モデル: ランダムフォレスト回帰 (Random Forest Regressor)

【問題の定式化】
  - 目的変数: 次の14日サイクルにおける商品ごとの推定消費量
  - 説明変数: 時間的特徴量（月・曜日・学期進行）、過去消費量ラグ、
              現在庫水準、商品ID
  - 出力:     消費予測値 → 推奨購買数量（安全在庫込み）

【候補モデルの比較検討】

  ① 線形回帰 (Linear Regression)
    ✗ 「試験期間に需要が急増」「GW明けに消費が変化」など
      学事暦由来の非線形パターンを表現できない
    → 却下

  ② ARIMA / SARIMA（時系列専用モデル）
    ✗ 外部特徴量（学事暦・商品カテゴリ等）の組み込みが困難
    ✗ 48商品 × 個別モデルが必要 → 管理コスト大
    ✗ 週次〜月次の粒度では季節性パラメータ推定に数年分のデータが必要
    → 却下

  ③ XGBoost / LightGBM（勾配ブースティング）
    △ 一般的に高精度だが、ハイパーパラメータ数が多く
      少量データでは過学習リスクが高い
    △ 本データは6サイクル分 (≒288サンプル) と少量
    → 将来データが蓄積された段階での乗り換え候補

  ④ ランダムフォレスト回帰 (採用)
    ✓ アンサンブル（多数の決定木の平均）により過学習を構造的に抑制
      → 少量データ (n ≈ 190〜240) への高い適応性
    ✓ 非線形パターン（学事暦・需要急増）を自然に学習可能
    ✓ feature_importances_ で「どの要因が購買量を左右するか」を可視化
      → 購買担当者への説明根拠として機能（ブラックボックスを回避）
    ✓ ハイパーパラメータが少なく、max_depth のみで過学習を制御できる
    → 採用

  ⑤ ニューラルネットワーク
    ✗ 少量データでは汎化困難、学習コストも高い
    → 却下

【特徴量選定の根拠】
  - lag1_consumption, lag2_consumption: 直近の消費トレンドが最重要
  - rolling2_mean: ラグの平均でノイズを平滑化
  - month, days_since_start: 学期進行・季節性（設計書§7参照）
  - stock_at_start: 欠品期間（需要が潜在化している）の検出
  - product_code: 商品固有の需要水準（例: エナジードリンクは低回転）

【評価手法】
  - Leave-One-Out Cross Validation (LOO-CV)
    → サイクル数が少ないため、通常の k-fold では
      テストセットが単一サンプルになりうる。LOO が最適。
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import os
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import requests
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import LeaveOneOut, cross_val_score

warnings.filterwarnings("ignore")

# Windowsコンソール（cp932）では絵文字・罫線・emダッシュ等が出力できないため、
# stdout/stderrをUTF-8に固定する
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


# ============================================================
# 設定
# ============================================================
# 本番のstock_recordはまだ実績が蓄積されていない（在庫を毎日記録する運用が
# 始まっていないため）。運用開始後は環境変数で実データCSVに切り替える。
PURCHASE_CSV = os.environ.get("KOBAI_PURCHASE_CSV", "dummy_purchase_history.csv")
STOCK_CSV = os.environ.get("KOBAI_STOCK_CSV", "dummy_stock_record.csv")
OUTPUT_CSV = "recommended_purchase.csv"

# 算出結果を書き込むAPI（バックエンド班のkobai-bu-api）
# 未設定ならAPI連携をスキップしてCSV出力のみ行う
API_BASE_URL = os.environ.get("KOBAI_API_BASE_URL", "")

SAFETY_STOCK_RATIO = 0.20   # 安全在庫: 予測消費量の 20%
MIN_ORDER_UNIT = 1          # 最小発注単位 (個)

RF_PARAMS = {
    "n_estimators": 300,
    "max_depth": 5,           # 少量データ対策: 深さ制限で過学習を防ぐ
    "min_samples_leaf": 3,    # 葉ノードの最小サンプル数でも過学習を抑制
    "max_features": "sqrt",   # ランダム性を高めてアンサンブル効果を向上
    "random_state": 42,
}

FEATURE_COLS = [
    "product_code",
    "month",
    "day_of_week",
    "days_since_start",
    "cycle_days",
    "stock_at_start",
    "lag1_consumption",
    "lag2_consumption",
    "rolling2_mean",
]
TARGET_COL = "estimated_consumption"


# ============================================================
# Step 1: データ読み込み
# ============================================================
def load_data(purchase_csv: str, stock_csv: str):
    purchase = pd.read_csv(purchase_csv, parse_dates=["purchase_date"])
    stock = pd.read_csv(stock_csv, parse_dates=["record_date"])
    return purchase, stock


# ============================================================
# Step 2: 在庫スナップショットから推定消費量を計算
# ============================================================
def get_stock_at_or_before(stock_df: pd.DataFrame, product_code: int, date: pd.Timestamp):
    """指定日以前で最も新しい在庫記録を返す"""
    mask = (stock_df["product_code"] == product_code) & (
        stock_df["record_date"] <= date
    )
    subset = stock_df.loc[mask]
    if subset.empty:
        return None
    return int(subset.sort_values("record_date").iloc[-1]["stock_count"])


def compute_cycle_consumption(
    purchase: pd.DataFrame, stock: pd.DataFrame
) -> pd.DataFrame:
    """
    購買日をサイクル境界として各サイクルの商品別推定消費量を算出する。

    推定消費量 = 前回購買日在庫 + サイクル内仕入数量 - 今回購買日在庫
    (設計書 §4「推定消費数量」の定義に準拠)
    """
    purchase_dates = sorted(purchase["purchase_date"].unique())
    products = sorted(stock["product_code"].unique())

    rows = []
    for i in range(len(purchase_dates) - 1):
        start_date = purchase_dates[i]
        end_date = purchase_dates[i + 1]
        cycle_days = (end_date - start_date).days

        for pc in products:
            s_start = get_stock_at_or_before(stock, pc, start_date)
            s_end = get_stock_at_or_before(stock, pc, end_date)
            if s_start is None or s_end is None:
                continue

            # サイクル内に発生した仕入れ (start_date翌日 〜 end_date)
            mask = (
                (purchase["product_code"] == pc)
                & (purchase["purchase_date"] > start_date)
                & (purchase["purchase_date"] <= end_date)
            )
            purchased = int(purchase.loc[mask, "quantity"].sum())

            consumption = max(0, s_start + purchased - s_end)

            rows.append(
                {
                    "cycle_idx": i,
                    "start_date": start_date,
                    "end_date": end_date,
                    "product_code": pc,
                    "stock_at_start": s_start,
                    "stock_at_end": s_end,
                    "purchased_in_cycle": purchased,
                    "estimated_consumption": consumption,
                    "cycle_days": cycle_days,
                }
            )

    return pd.DataFrame(rows)


# ============================================================
# Step 3: 特徴量エンジニアリング
# ============================================================
def engineer_features(cycles: pd.DataFrame) -> pd.DataFrame:
    """
    時間特徴量とラグ特徴量を追加する。

    特徴量の設計根拠:
    - month / day_of_week   : 月・曜日ごとの需要パターン（学事暦の代理変数）
    - days_since_start      : 学期進行（前半〜後半で需要が変化する）
    - lag1_consumption      : 前サイクルの消費量（最強の予測因子）
    - lag2_consumption      : 2サイクル前（トレンドの方向性を把握）
    - rolling2_mean         : ラグ平均（ノイズ除去）
    - stock_at_start        : 在庫水準（欠品期間は消費量が過小評価されるため含める）
    - cycle_days            : サイクル長（14日以外の周期ずれに対応）
    """
    df = cycles.copy().sort_values(["product_code", "start_date"])
    base_date = df["start_date"].min()

    df["month"] = df["start_date"].dt.month
    df["day_of_week"] = df["start_date"].dt.dayofweek
    df["days_since_start"] = (df["start_date"] - base_date).dt.days

    grp = df.groupby("product_code")["estimated_consumption"]
    df["lag1_consumption"] = grp.shift(1)
    df["lag2_consumption"] = grp.shift(2)
    df["rolling2_mean"] = (df["lag1_consumption"] + df["lag2_consumption"]) / 2

    # ラグ特徴量が計算できない最初の 2 サイクルは除外
    df = df.dropna(subset=["lag1_consumption", "lag2_consumption"])
    return df.reset_index(drop=True)


# ============================================================
# Step 4: モデル学習と交差検証
# ============================================================
def train_and_evaluate(df: pd.DataFrame) -> RandomForestRegressor:
    X = df[FEATURE_COLS].values
    y = df[TARGET_COL].values

    model = RandomForestRegressor(**RF_PARAMS)

    # LOO-CV でモデルの汎化性能を推定
    loo = LeaveOneOut()
    cv_scores = cross_val_score(
        model, X, y, cv=loo, scoring="neg_mean_absolute_error"
    )
    mae_loo = -cv_scores.mean()
    print(f"    LOO-CV 平均絶対誤差 (MAE): {mae_loo:.2f} 個/サイクル")
    print(f"    学習サンプル数: {len(df)}")

    model.fit(X, y)
    return model


# ============================================================
# Step 5: 次サイクルの推奨購買数量を算出
# ============================================================
def predict_next_cycle(
    model: RandomForestRegressor,
    feature_df: pd.DataFrame,
    cycles_df: pd.DataFrame,
    purchase: pd.DataFrame,
    stock: pd.DataFrame,
) -> pd.DataFrame:
    """
    推奨購買数量の算出式:
      推奨購買数量 = ceil(予測消費量 × (1 + 安全在庫率) - 現在庫)
      推奨購買数量が負 → 0 (購買不要)

    安全在庫率 = 20% （欠品リスクを考慮したバッファ）
    """
    base_date = feature_df["start_date"].min()
    last_purchase_date = purchase["purchase_date"].max()
    products = sorted(stock["product_code"].unique())

    next_start = last_purchase_date
    next_month = next_start.month
    next_dow = next_start.dayofweek
    days_since = int((next_start - base_date).days)
    # 次回発注日は学習データ上の日付ではなく、実際にこの分析を実行した日から
    # 14日周期で計算する（学習データの最終購買日を使うと常に同じ日付に固定されてしまうため）
    next_order_date = pd.Timestamp.now().normalize() + pd.Timedelta(days=14)

    rows = []
    for pc in products:
        pc_cycles = cycles_df[cycles_df["product_code"] == pc].sort_values("start_date")
        if len(pc_cycles) < 2:
            continue

        lag1 = float(pc_cycles["estimated_consumption"].iloc[-1])
        lag2 = float(pc_cycles["estimated_consumption"].iloc[-2])
        rolling2 = (lag1 + lag2) / 2
        current_stock = get_stock_at_or_before(stock, pc, next_start) or 0

        X_pred = np.array(
            [[pc, next_month, next_dow, days_since, 14,
              current_stock, lag1, lag2, rolling2]]
        )

        pred = float(model.predict(X_pred)[0])
        pred = max(0.0, pred)

        needed = pred * (1 + SAFETY_STOCK_RATIO)
        rec_qty = max(0, int(np.ceil(needed - current_stock)))
        rec_qty = (rec_qty // MIN_ORDER_UNIT) * MIN_ORDER_UNIT if rec_qty > 0 else 0

        rows.append(
            {
                "商品コード": pc,
                "現在庫": current_stock,
                "前サイクル消費量": round(lag1, 1),
                "予測消費量_次14日": round(pred, 1),
                "推奨購買数量": rec_qty,
                "購買要否": "要購買" if rec_qty > 0 else "在庫充足",
                "次回発注日": next_order_date.strftime("%Y-%m-%d"),
            }
        )

    result = pd.DataFrame(rows).sort_values("推奨購買数量", ascending=False)
    return result


# ============================================================
# Step 6: 特徴量重要度の可視化
# ============================================================
def show_feature_importance(model: RandomForestRegressor) -> None:
    importances = pd.Series(model.feature_importances_, index=FEATURE_COLS)
    importances = importances.sort_values(ascending=False)

    print("\n  [特徴量重要度 — モデルの判断根拠]")
    print(f"  {'特徴量':<25} {'重要度':>6}  バー")
    print(f"  {'-'*25} {'-'*6}  {'-'*30}")
    for feat, imp in importances.items():
        bar = "█" * max(1, int(imp * 50))
        feat_ja = {
            "lag1_consumption": "前サイクル消費量 (lag1)",
            "lag2_consumption": "2サイクル前消費量 (lag2)",
            "rolling2_mean": "直近2サイクル平均",
            "product_code": "商品コード",
            "stock_at_start": "サイクル開始時在庫",
            "days_since_start": "データ開始からの経過日",
            "month": "月",
            "day_of_week": "曜日",
            "cycle_days": "サイクル日数",
        }.get(feat, feat)
        print(f"  {feat_ja:<25} {imp:>6.3f}  {bar}")


# ============================================================
# Step 7: 算出結果をAPIへ送信
# ============================================================
def post_recommendations(result_df: pd.DataFrame) -> None:
    if not API_BASE_URL:
        print("\n  [Step 7] KOBAI_API_BASE_URL未設定のためAPI送信はスキップ")
        return

    items = [
        {
            "product_code": int(row["商品コード"]),
            "current_stock": int(row["現在庫"]),
            "last_cycle_consumption": float(row["前サイクル消費量"]),
            "predicted_consumption": float(row["予測消費量_次14日"]),
            "recommended_qty": int(row["推奨購買数量"]),
            "purchase_needed": row["購買要否"] == "要購買",
            "next_order_date": row["次回発注日"],
        }
        for _, row in result_df.iterrows()
    ]

    url = API_BASE_URL.rstrip("/") + "/api/recommendations"
    res = requests.post(url, json={"items": items}, timeout=15)
    res.raise_for_status()
    print(f"\n  [Step 7] APIへ送信完了: {url} ({len(items)}件)")


# ============================================================
# メイン
# ============================================================
def main():
    script_dir = Path(__file__).parent

    print("=" * 60)
    print("  購買傾向分析・推奨購買数量算出システム")
    print("  (ランダムフォレスト回帰 / 14日サイクル)")
    print("=" * 60)

    # ── Step 1: データ読み込み ──────────────────────────────
    print("\n[Step 1] CSV 読み込み")
    purchase, stock = load_data(
        str(script_dir / PURCHASE_CSV),
        str(script_dir / STOCK_CSV),
    )
    print(f"  仕入れ履歴: {len(purchase):,} 件")
    print(f"  在庫変動記録: {len(stock):,} 件")
    print(f"  購買日: {sorted(purchase['purchase_date'].dt.date.unique())}")

    # ── Step 2: 推定消費量の計算 ────────────────────────────
    print("\n[Step 2] 14日サイクルごとの推定消費量を算出")
    cycles_df = compute_cycle_consumption(purchase, stock)
    n_cycles = cycles_df["cycle_idx"].nunique()
    n_products = cycles_df["product_code"].nunique()
    print(f"  サイクル数: {n_cycles}、商品数: {n_products}")

    # ── Step 3: 特徴量エンジニアリング ─────────────────────
    print("\n[Step 3] 特徴量エンジニアリング")
    feature_df = engineer_features(cycles_df)
    print(f"  有効学習サンプル: {len(feature_df)} 件")
    print(f"  使用特徴量: {FEATURE_COLS}")

    # ── Step 4: モデル学習・評価 ────────────────────────────
    print("\n[Step 4] ランダムフォレストモデルを学習・評価")
    model = train_and_evaluate(feature_df)

    # ── Step 5: 推奨購買数量を算出 ─────────────────────────
    print("\n[Step 5] 次サイクル推奨購買数量を算出")
    result_df = predict_next_cycle(model, feature_df, cycles_df, purchase, stock)

    # ── 結果表示 ────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  【推奨購買数量一覧】")
    print("=" * 60)
    with pd.option_context("display.max_rows", None, "display.width", 120):
        print(result_df.to_string(index=False))

    # ── CSV 保存 ────────────────────────────────────────────
    out_path = script_dir / OUTPUT_CSV
    result_df.to_csv(out_path, index=False, encoding="utf-8-sig")
    print(f"\n  → 結果を保存: {out_path}")

    # ── 特徴量重要度 ────────────────────────────────────────
    show_feature_importance(model)

    # ── API送信 ──────────────────────────────────────────────
    post_recommendations(result_df)

    # ── サマリ統計 ──────────────────────────────────────────
    need_buy = result_df[result_df["購買要否"] == "要購買"]
    print(f"\n  要購買商品数: {len(need_buy)} 品目 / 全{len(result_df)} 品目")
    print(f"  推奨総購買数量: {result_df['推奨購買数量'].sum():,} 個")


if __name__ == "__main__":
    main()
