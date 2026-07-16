# AI情報

## モデル概要（`ai/purchase_prediction.py`）

- **手法**: ランダムフォレスト回帰（少量データ・非線形パターンへの適応性・特徴量重要度による説明性を理由に採用。線形回帰／ARIMA／LightGBM／ニューラルネットは却下。詳細な比較検討はスクリプト冒頭のコメント参照）
- **周期**: 14日サイクル（月2回入荷の運用に合わせる）
- **目的変数**: サイクルごとの推定消費量（`前回在庫 + サイクル内仕入数量 - 今回在庫`）
- **説明変数**: `product_code`, `month`, `day_of_week`, `days_since_start`, `cycle_days`, `stock_at_start`, `lag1_consumption`, `lag2_consumption`, `rolling2_mean`
- **評価**: Leave-One-Out Cross Validation（サイクル数が少ないため）
- **出力**: 商品ごとの「予測消費量」「推奨購買数量（安全在庫20%込み）」「購買要否」

## API連携（実装済み）

`②バックエンド` 側で `POST /api/recommendations` を用意し、スクリプトの実行結果を本番APIに書き込めるようにした。実行例:

```bash
cd ai
pip install -r requirements.txt
export KOBAI_API_BASE_URL="https://1acuynf6vk.execute-api.us-east-1.amazonaws.com"
python purchase_prediction.py
```

`KOBAI_API_BASE_URL` を設定すると、CSV保存に加えて算出結果全件を `POST {API_BASE_URL}/api/recommendations` に送信する（未設定ならCSV出力のみでAPI送信はスキップ）。書き込まれた内容は `GET /api/recommendations` で取得でき、確認用UI（`public/index.html`）の「AI推奨発注数」セクションにも表示される。

## 入出力

| 種別 | ファイル / エンドポイント | 備考 |
| --- | --- | --- |
| 入力 | `dummy_purchase_history.csv` | 仕入れ履歴（下記「実データ未対応の理由」参照） |
| 入力 | `dummy_stock_record.csv` | 在庫記録 |
| 出力 | `recommended_purchase.csv` | ローカル確認用に引き続き出力 |
| 出力 | `POST /api/recommendations` | チーム全体で参照する本番の推奨値 |

## ⚠️ 現状は実データではなくダミーデータで動いている

`db/master/stock_record.csv`（本番の在庫記録）は**まだ0件**（在庫を毎日記録する運用が始まっていないため）。このモデルは「サイクル境界の在庫スナップショット」が無いと消費量を計算できないので、今のところ実データでは学習できない。そのため `ai/dummy_*.csv`（AI班が用意した学習用データ）を使い続けている。

**実データに切り替える条件**: `POST /api/stock-records` で在庫記録が複数サイクル分（最低3回の仕入れタイミング分）蓄積されたら、環境変数で切り替え可能:

```bash
export KOBAI_PURCHASE_CSV=../db/master/purchase_history.csv   # または API から取得したものをCSV化
export KOBAI_STOCK_CSV=<実在庫記録のCSV>
python purchase_prediction.py
```

（現状は `purchase_history.csv` はスクリプトの相対パス起点で `ai/` からの相対参照になっている点に注意。実データ運用に切り替える際はパス調整が必要）

## 今後の相談ポイント

- バッチ実行のタイミング（14日サイクルごとに誰が・どうやって実行するか。手動 / EventBridgeでの自動化は[docs/aws-todo.md](aws-todo.md)参照）
- 在庫の日次記録をいつから本番運用として始めるか（③DB班・運用側と要相談）
