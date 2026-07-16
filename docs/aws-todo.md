# AWS情報

## 現状（デプロイ済み）

企画時の構成（API Gateway + Lambda + DynamoDB）で、②担当が実際にデプロイまで実施済み。

- **API Gateway (HTTP API)**: Lambdaプロキシ統合、`ANY /{proxy+}`
- **Lambda**: Node.js 20.x、Expressアプリを `@codegenie/serverless-express` でラップして実行（`src/lambda.js`）
- **DynamoDB**: 5テーブル（オンデマンド課金）。ER図の5テーブルに対応
  - `kobai-genres`（PK: `genre_id`）
  - `kobai-products`（PK: `product_code`、GSI: `genre-index`）
  - `kobai-price-revisions`（PK: `product_code`, SK: `effective_date`）
  - `kobai-purchase-history`（PK: `product_code`, SK: `sort_key` = `purchase_date#purchase_id`）
  - `kobai-stock-records`（PK: `product_code`, SK: `record_date`）
- **IAM**: AWS Academy Learner Labの制約上、新規ロール作成はできないため、Lambda実行ロールは既存の `LabRole` を使用
- **リージョン**: `us-east-1`

マスタデータ（`db/master/*.csv`）は `scripts/seed-dynamodb.js` で投入済み。

## デプロイ方法（再デプロイ・チーム内共有用）

```bash
aws configure   # AWS Academy Learner Lab の一時認証情報（Access Key/Secret/Session Token）を設定
export AWS_REGION=us-east-1
./deploy/create-tables.sh       # DynamoDBテーブル作成（存在すればスキップ）
node scripts/seed-dynamodb.js   # マスタデータ投入
./deploy/deploy.sh              # Lambda + API Gatewayを作成/更新
```

`deploy.sh` は既存のLambda関数があれば `update-function-code` で更新するので、コード変更後の再デプロイもこのスクリプト1本でOK。

## 重要な注意点（AWS Academy Learner Lab特有）

- **認証情報は一時的**（数時間で失効）。Labセッションを開始し直したら `aws configure` からやり直しが必要
- **Learner Labはセッション終了時にリソースが削除される場合がある**。発表前に一度 `deploy.sh` を再実行して動作確認しておくこと
- IAMロールを新規作成できないため、権限が足りない操作（新しいマネージドポリシーのアタッチなど）が必要になったら要相談

## 未確定・要検討

- 現状は素のAWS CLIコマンドで構築（`deploy/`配下のシェルスクリプト）。今後インフラが複雑化するならSAM/CDK化を検討してもよいが、Academy LabはIAMロール作成が制限されているため、CDK bootstrapが失敗する可能性が高い点に注意
- CI/CD（GitHub Actionsからの自動デプロイ）は未設定
- カスタムドメイン・HTTPS証明書は未設定（API Gatewayのデフォルトエンドポイントをそのまま使用）
- AI班の推奨購買数量をどう連携するか（[docs/ai.md](ai.md)）が固まったら、Lambda側にもエンドポイント追加が必要
