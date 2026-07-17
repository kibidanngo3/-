# 購買部 在庫管理システム API仕様

- Base URL（本番・AWS）: `https://1acuynf6vk.execute-api.us-east-1.amazonaws.com`
- Base URL（ローカル開発時）: `http://localhost:3000`
- 全レスポンスは JSON
- 日付は `YYYY-MM-DD` 形式の文字列
- データストアはAmazon RDS for PostgreSQL（全API移行・本番デプロイ済み。`src/postgres.js`、Lambdaは VPC内 → RDS）。DynamoDB版は`src/dynamo.js`にロールバック用として残置（[rds-migration.md](rds-migration.md)参照）
- DB班のマスタCSVは `npm run db:init && npm run db:seed` でRDSへ投入する

## ジャンル

### GET /api/genres
ジャンル一覧を取得。

```json
[
  { "genre_id": 1, "genre_name": "カップ麺" },
  { "genre_id": 2, "genre_name": "冷凍麺" }
]
```

### POST /api/genres
ジャンルを追加。

リクエスト:
```json
{ "genre_name": "パン" }
```

レスポンス (201):
```json
{ "genre_id": 10, "genre_name": "パン" }
```

---

## 商品

### GET /api/products
商品一覧を取得。各商品には**現行売値**（`price_revisions`の最新行）と**最新在庫数**が付与される。

クエリパラメータ:
- `genre_id`（任意）: ジャンルで絞り込み

```json
[
  {
    "product_code": 1,
    "product_name": "オーマイBigバター醤油",
    "genre_id": 2,
    "genre_name": "冷凍麺",
    "temp_zone": "冷凍",
    "container": null,
    "volume_ml": null,
    "current_price": 250,
    "price_effective_date": "2025-01-09",
    "current_stock": null,
    "stock_recorded_at": null
  }
]
```

`container` / `volume_ml` は飲料以外の商品では `null`。`current_price` / `current_stock` は対応する記録が無ければ `null`。

### GET /api/products/:code
商品1件を取得（売値改定履歴を含む）。

```json
{
  "product_code": 13,
  "product_name": "やきそば弁当",
  "genre_id": 1,
  "temp_zone": "常温",
  "container": null,
  "volume_ml": null,
  "current_price": 170,
  "price_history": [
    { "revision_id": 13, "product_code": 13, "effective_date": "2025-07-09", "price": 170 }
  ]
}
```

404: 商品が存在しない場合 `{ "error": "product not found" }`

### POST /api/products
商品を新規登録。`price` を指定すると初回の売値改定履歴も同時に作成される。

リクエスト:
```json
{
  "product_name": "緑茶500ml",
  "genre_id": 5,
  "temp_zone": "冷蔵",
  "container": "ペットボトル",
  "volume_ml": 500,
  "price": 150,
  "effective_date": "2026-07-17"
}
```
`temp_zone` / `container` / `volume_ml` / `price` / `effective_date` は任意（`effective_date` 省略時は当日日付）。

レスポンス (201): `{ "product_code": 49 }`

409: `product_name` が重複している場合

### PUT /api/products/:code
商品の基本情報を更新（価格は含まない。価格変更は `/api/price-revisions` を使う）。

リクエスト:
```json
{ "temp_zone": "冷凍" }
```

レスポンス: 更新後の商品レコード

### DELETE /api/products/:code
商品を削除。成功時 204 No Content。

---

## 売値改定履歴

現行売値は単一カラムではなく、この履歴テーブルの最新行から導出される（値段変動に対応するため）。

### GET /api/price-revisions
売値改定履歴一覧（新しい順）。

クエリパラメータ（任意）: `product_code`

```json
[
  { "revision_id": 13, "product_code": 13, "effective_date": "2025-07-09", "price": 170 }
]
```

### POST /api/price-revisions
売値改定を追加。

リクエスト:
```json
{ "product_code": 13, "effective_date": "2026-08-01", "price": 180 }
```

レスポンス (201): `{ "revision_id": 49 }`

404: `product_code` が存在しない場合

---

## 仕入れ履歴

### GET /api/purchases
仕入れ履歴一覧（新しい順）。

クエリパラメータ（すべて任意）:
- `product_code`
- `from` / `to`（`purchase_date` の範囲）

```json
[
  { "purchase_id": 1, "purchase_date": "2025-01-09", "product_code": 1, "quantity": 3, "amount": 717 }
]
```

### POST /api/purchases
仕入れ履歴を追加。

リクエスト:
```json
{ "purchase_date": "2026-07-17", "product_code": 1, "quantity": 100, "amount": 10000 }
```
`amount` は任意。

レスポンス (201): `{ "purchase_id": 95 }`

404: `product_code` が存在しない場合

---

## 在庫変動記録

### GET /api/stock-records
在庫記録一覧（新しい順）。

クエリパラメータ（すべて任意）:
- `product_code`
- `from` / `to`（`record_date` の範囲）

```json
[
  { "record_id": 1, "record_date": "2026-07-10", "product_code": 1, "stock_count": 40 }
]
```

### GET /api/stock-records/current
商品ごとの最新在庫数のみを一覧取得（AI予測の入力データ取得などに利用想定）。

```json
[
  { "product_code": 1, "stock_count": 40, "record_date": "2026-07-10" }
]
```

### POST /api/stock-records
在庫数を記録。同じ `record_date` + `product_code` が既に存在する場合は上書き。

リクエスト:
```json
{ "record_date": "2026-07-10", "product_code": 1, "stock_count": 40 }
```

レスポンス (201): 保存されたレコード

404: `product_code` が存在しない場合

---

## AI推奨発注数

AI班の `ai/purchase_prediction.py` が算出した推奨購買数量を保存・取得する。詳細は[ai.md](ai.md)参照。

### GET /api/recommendations
推奨購買数量が多い順の一覧。

```json
[
  {
    "product_code": 29,
    "current_stock": 5,
    "last_cycle_consumption": 49,
    "predicted_consumption": 17.8,
    "recommended_qty": 17,
    "purchase_needed": true,
    "generated_at": "2026-07-16T16:43:51.323Z"
  }
]
```

### POST /api/recommendations
AI班のバッチスクリプトが算出結果をまとめて書き込む（商品ごとに1レコードで上書き）。

リクエスト:
```json
{
  "items": [
    { "product_code": 29, "current_stock": 5, "last_cycle_consumption": 49, "predicted_consumption": 17.8, "recommended_qty": 17, "purchase_needed": true }
  ]
}
```

レスポンス (201): `{ "saved": 48, "generated_at": "2026-07-16T16:43:51.323Z" }`

---

## 未確定・要相談

- 在庫記録は日単位（`record_date` は日付のみ）
- AI推奨値は現状ダミーデータに基づく参考値（本番の在庫記録がまだ蓄積されていないため。詳細は[ai.md](ai.md)）
