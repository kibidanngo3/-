# RDS移行手順

既存のNode.js + Express APIを、DynamoDBからAmazon RDS for PostgreSQLへ移行するための手順を記録する。

## 本番デプロイ実績

全API移行後、実際にAWS上で以下を構築・検証済み（2026-07-17）。

- RDSインスタンス: `kobai-bu-rds`（PostgreSQL 16.9, db.t3.micro, us-east-1, default VPC）
- Lambda `kobai-bu-api` をVPC内（default VPCのサブネット3つ + defaultセキュリティグループ）で再デプロイ
- RDS側セキュリティグループ（`kobai-rds-sg`）は、Lambda用のdefaultセキュリティグループからの5432のみ許可。インターネットには公開していない（作成直後にセットアップ用として一時的に許可していた自分のIPは、動作確認後に削除済み）
- API Gateway（`kobai-bu-api`、既存の`1acuynf6vk`エンドポイントをそのまま利用）経由で全エンドポイントの疎通確認済み（GET/POSTとも）
- `deploy/create-rds.sh`・`deploy/deploy-rds.sh`としてスクリプト化（下記手順を自動化）

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

## デプロイ手順（スクリプト化済み）

```bash
# 1. RDSインスタンス・VPCリソースを作成（既存ならスキップされる）
export DB_MASTER_PASSWORD=<新規作成時のみ・強力なパスワード>
./deploy/create-rds.sh
# → DB_HOST=<RDSエンドポイント> が出力される

# 2. スキーマ作成・マスタデータ投入
export DB_HOST=<上記の出力> DB_PORT=5432 DB_NAME=kobaidb DB_USER=kobaiadmin DB_PASSWORD=<同上> DB_SSL=true
npm run db:init
npm run db:seed

# 3. Lambda（VPC内）+ API Gatewayをデプロイ
./deploy/deploy-rds.sh
```

`deploy-rds.sh`は`src/` `public/` `node_modules`(本番依存のみ)をZIP化し、Lambda関数の作成/更新・VPC設定・環境変数設定・API Gateway統合までを一括で行う。`.env`はZIPに含めない。

## Lambda設定（実績）

| 項目 | 設定 |
| --- | --- |
| 関数名 | `kobai-bu-api` |
| ランタイム | Node.js 20.x |
| アーキテクチャ | x86_64 |
| 実行ロール | `LabRole`（AWS Academy Learner Labの既存ロール。新規IAMロール作成不可のため） |
| ハンドラー | `src/lambda.handler` |
| メモリ | 256 MB |
| タイムアウト | 15秒 |
| VPC | default VPC、サブネット3つ、defaultセキュリティグループ |

### VPC・セキュリティグループ

- Lambdaはdefault VPCのサブネットに配置し、defaultセキュリティグループを使用
- RDS用セキュリティグループ（`kobai-rds-sg`）は、Lambda用のdefaultセキュリティグループからのTCP 5432のみ許可
- RDSは`--publicly-accessible`だが、セキュリティグループでIPベースのアクセスを許可していないため実質非公開（スキーマ作成・データ投入などの初回セットアップ時のみ、作業者のIPを一時的に許可し、完了後に削除する運用）

### 環境変数

```text
DB_HOST=<RDSエンドポイント>
DB_PORT=5432
DB_NAME=kobaidb
DB_USER=kobaiadmin
DB_PASSWORD=<データベースパスワード>
DB_SSL=true
DB_POOL_MAX=5
```

実際の値やパスワードをGitHub、README、スクリーンショットへ載せない（`.gitignore`で`.env`は除外済み）。将来の本番運用ではAWS Secrets Managerの利用を検討する。

## API Gateway設定

| 項目 | 設定 |
| --- | --- |
| APIタイプ | HTTP API |
| ルート | `GET /api/products` |
| 統合先 | Lambda `kobai-bu-api` |
| ペイロード形式 | 2.0 |
| ステージ | `$default` |
| 自動デプロイ | 有効 |

全APIルート（[API.md](API.md)参照）をLambda統合に紐づける。書き込み系API（POST/PUT/DELETE）は認証が無いままインターネットに公開される点に留意（[aws-todo.md](aws-todo.md)の課題）。

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

- `deploy/deploy.sh`・`deploy/create-tables.sh`はDynamoDB版の構築手順。ロールバックする場合はこちらを再実行する（DynamoDBのテーブル・データは削除していないのでそのまま使える）
- DynamoDB版とPython版Lambdaは当面削除しない（ロールバック手段として）
- 書き込み系APIには認証が無い。デモ・検証目的の範囲にとどめる
- AWS Academy Learner Labのセッションが切れるとRDSインスタンス・Lambda・VPCリソースが削除される場合がある。動かない時は`./deploy/create-rds.sh`から再実行する
- RDSのマスターパスワードはSecrets Manager等に保存していない（Learner Labの一時利用のため）。再デプロイのたびに新しいパスワードで作り直すか、チーム内で安全な方法（パスワードマネージャー等）で共有する
