# RDS移行手順

既存のNode.js + Express APIを、DynamoDBからAmazon RDS for PostgreSQLへ段階的に移行するための手順を記録する。

## 現在の移行範囲

- **全API（`/api/genres` `/api/products` `/api/price-revisions` `/api/purchases` `/api/stock-records` `/api/recommendations`）をRDSへ移行済み**（`src/postgres.js`）
- DynamoDB版（`src/dynamo.js`、`deploy/create-tables.sh`、`scripts/seed-dynamodb.js`）はロールバック用に削除せず残している
- Python版の `purchasing-products-api`: 比較・検証用として残す

`GET /api/products`のみの段階移行から、`src/postgres.js`のパターン（LATERAL JOINで最新の売値・在庫を取得、`ON CONFLICT`でupsert）を踏襲して残りのAPIも移行した。

## スキーマ・データ投入

```bash
# 環境変数（DB_HOST等）を設定した状態で実行
npm run db:init   # scripts/schema.sql を適用（冪等）
npm run db:seed   # db/master/*.csv を投入（冪等）
```

テーブル定義は `scripts/schema.sql` を参照（genres / products / price_revisions / purchase_history / stock_records / recommendations の6テーブル）。

## 現在の構成

```text
ブラウザ / フロント
        ↓
API Gateway HTTP API
        ↓
Node.js Lambda（kobai-bu-api）
        ↓
Amazon RDS for PostgreSQL
```

## Lambdaデプロイパッケージ

`node_modules`を含むZIPファイルを作成する。`.env`は含めない。

```powershell
npm install
tar.exe -a -c -f function.zip src public node_modules package.json package-lock.json
```

ZIPには少なくとも次が含まれていることを確認する。

```text
src/lambda.js
src/postgres.js
node_modules/pg/
package.json
```

## Lambda設定

| 項目 | 設定 |
| --- | --- |
| 関数名 | `kobai-bu-api` |
| ランタイム | Node.js 24.x |
| アーキテクチャ | x86_64 |
| 実行ロール | AWS Academyで利用可能な既存実行ロール |
| ハンドラー | `src/lambda.handler` |
| メモリ | 256 MB |
| タイムアウト | 15秒 |

### VPC

- RDSへ接続できる既存Lambdaと同じVPC・サブネットを使用する
- LambdaにはRDS接続用セキュリティグループを設定する
- RDS側のセキュリティグループで、Lambda側セキュリティグループからのTCP 5432を許可する
- RDSをインターネットへ公開しない

### 環境変数

```text
DB_HOST=<RDSエンドポイント>
DB_PORT=5432
DB_NAME=<データベース名>
DB_USER=<データベースユーザー>
DB_PASSWORD=<データベースパスワード>
DB_SSL=true
DB_POOL_MAX=5
```

実際の値やパスワードをGitHub、README、スクリーンショットへ載せない。将来の本番運用ではAWS Secrets Managerの利用を検討する。

## API Gateway設定

| 項目 | 設定 |
| --- | --- |
| APIタイプ | HTTP API |
| ルート | `GET /api/products` |
| 統合先 | Lambda `kobai-bu-api` |
| ペイロード形式 | 2.0 |
| ステージ | `$default` |
| 自動デプロイ | 有効 |

全APIルート（`API.md`参照）をLambda統合に紐づける。書き込み系API（POST/PUT/DELETE）は認証が無いままインターネットに公開される点に留意（[docs/aws-todo.md](aws-todo.md)の課題）。

呼び出しURL例:

```text
https://<API-ID>.execute-api.us-east-1.amazonaws.com/api/products
https://<API-ID>.execute-api.us-east-1.amazonaws.com/api/recommendations
```

## 動作確認

### Lambda単体

API Gateway HTTP APIのペイロード形式2.0に相当するテストイベントで`GET /api/products`を実行する。

成功条件:

```json
{
  "statusCode": 200
}
```

### API Gateway経由

ブラウザまたはHTTPクライアントから`GET /api/products`を呼び出し、商品情報がJSON配列で返ることを確認する。

期待する主なフィールド:

```text
product_code
product_name
genre_id
genre_name
temp_zone
container
volume_ml
current_price
price_effective_date
current_stock
stock_recorded_at
```

## トラブルシューティング

### `Connection terminated due to connection timeout`

LambdaではなくローカルPCから非公開RDSへ接続した場合や、VPC・サブネット・セキュリティグループが正しくない場合に発生する。非公開RDSの動作確認は、同じVPCに接続したLambdaから行う。

### `no pg_hba.conf entry ... no encryption`

RDSがSSL接続を要求している。Lambdaの環境変数を次のように設定する。

```text
DB_SSL=true
```

### `{"error":"not found"}`

API GatewayからLambdaへは到達しているが、Expressのルートと受信パスが一致していない。HTTP APIでは`$default`ステージを使用し、`/api/products`がそのままExpressへ渡る構成にする。

### `{"message":"Not Found"}`

API Gateway側でルートが一致していない。`GET /api/products`のルート、ステージへのデプロイ、Lambda統合を確認する。

## 現時点の注意事項

- `deploy/deploy.sh`はDynamoDB版の構築手順であり、RDS版のVPC・環境変数・API Gateway設定を再現しない。RDS版のデプロイには使わないこと（VPC設定込みのデプロイスクリプトは今後整備する）
- DynamoDB版とPython版Lambdaは当面削除しない（ロールバック手段として）
- RDSインスタンス自体（エンドポイント・VPC・セキュリティグループ）は既存のものを前提としている。新規に払い出す場合はAWS Academy Learner Labでの権限（VPC作成・セキュリティグループ変更等）を先に確認する
- 書き込み系APIには認証が無い。デモ・検証目的の範囲にとどめる
