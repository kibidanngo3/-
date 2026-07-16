# AI情報

## モデル概要（`ai/purchase_prediction.py`）

- **手法**: ランダムフォレスト回帰（少量データ・非線形パターンへの適応性・特徴量重要度による説明性を理由に採用。線形回帰／ARIMA／LightGBM／ニューラルネットは却下。詳細な比較検討はスクリプト冒頭のコメント参照）
- **周期**: 14日サイクル（月2回入荷の運用に合わせる）
- **目的変数**: サイクルごとの推定消費量（`前回在庫 + サイクル内仕入数量 - 今回在庫`）
- **説明変数**: `product_code`, `month`, `day_of_week`, `days_since_start`, `cycle_days`, `stock_at_start`, `lag1_consumption`, `lag2_consumption`, `rolling2_mean`
- **評価**: Leave-One-Out Cross Validation（サイクル数が少ないため）
- **出力**: 商品ごとの「予測消費量」「推奨購買数量（安全在庫20%込み）」「購買要否」

## 実行方法

```bash
cd ai
pip install -r requirements.txt
python purchase_prediction.py
```

## 入出力

| 種別 | ファイル | 備考 |
| --- | --- | --- |
| 入力 | `dummy_purchase_history.csv` | 学習用ダミーの仕入れ履歴 |
| 入力 | `dummy_stock_record.csv` | 学習用ダミーの在庫記録 |
| 出力 | `recommended_purchase.csv` | 商品コード・現在庫・前サイクル消費量・予測消費量・推奨購買数量・購買要否 |

## 現状の課題（API未連携）

今はCSVを直接読み書きするだけの独立バッチスクリプト。本番では以下をAPI経由に置き換える必要がある。

- **入力**: `dummy_*.csv` の代わりに `GET /api/purchases` / `GET /api/stock-records` を叩いて実データを取得
- **出力**: `recommended_purchase.csv` に書く代わりに、予測結果をAPIへ書き戻す（例: `POST /api/recommendations` のような新エンドポイントが必要 ← バックエンド側で用意する）

この連携方法（バッチ実行のタイミング・APIのスキーマ）は要相談。
