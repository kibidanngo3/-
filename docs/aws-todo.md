# AWS情報

## 現状（デプロイ済み）

企画時の構成（API Gateway + Lambda + RDS）で、②担当が実際にデプロイまで実施済み。詳しい手順・トラブルシューティングは [rds-migration.md](rds-migration.md) を参照。

- **API Gateway (HTTP API)**: Lambdaプロキシ統合、`ANY /{proxy+}`
- **Lambda**: Node.js 20.x、Expressアプリを `@codegenie/serverless-express` でラップして実行（`src/lambda.js`）。default VPC内に配置し、RDSと同じセキュリティグループ経由で通信
- **RDS for PostgreSQL**: `kobai-bu-rds`（db.t3.micro、us-east-1、default VPC）。ER図の6テーブルに対応（`scripts/schema.sql`）
- **IAM**: AWS Academy Learner Labの制約上、新規ロール作成はできないため、Lambda実行ロールは既存の `LabRole` を使用
- **リージョン**: `us-east-1`

マスタデータ（`db/master/*.csv`）は `npm run db:seed` で投入済み。

## デプロイ方法（再デプロイ・チーム内共有用）

```bash
aws configure   # AWS Academy Learner Lab の一時認証情報（Access Key/Secret/Session Token）を設定
export AWS_REGION=us-east-1

export DB_MASTER_PASSWORD=<新規作成時のみ>
./deploy/create-rds.sh   # RDSインスタンス作成（既存なら何もしない）。DB_HOSTを出力

export DB_HOST=<create-rds.shの出力> DB_USER=kobaiadmin DB_PASSWORD=<同上>
npm run db:init && npm run db:seed

./deploy/deploy-rds.sh   # Lambda（VPC内）+ API Gatewayを作成/更新
```

`deploy-rds.sh` は既存のLambda関数があれば `update-function-code` で更新するので、コード変更後の再デプロイもこのスクリプト1本でOK。

## 重要な注意点（AWS Academy Learner Lab特有）

- **認証情報は一時的**（数時間で失効）。Labセッションを開始し直したら `aws configure` からやり直しが必要
- **Learner Labはセッション終了時にリソースが削除される場合がある**。発表前に一度 `deploy-rds.sh` を再実行して動作確認しておくこと
- IAMロールを新規作成できないため、権限が足りない操作（新しいマネージドポリシーのアタッチなど）が必要になったら要相談
- RDSのマスターパスワードはSecrets Manager等に保存していない。再作成のたびに`DB_MASTER_PASSWORD`を指定し、チーム内で安全な方法（パスワードマネージャー等）で共有する

## 未確定・要検討

- 現状は素のAWS CLIコマンドで構築（`deploy/`配下のシェルスクリプト）。今後インフラが複雑化するならSAM/CDK化を検討してもよいが、Academy LabはIAMロール作成が制限されているため、CDK bootstrapが失敗する可能性が高い点に注意
- CI/CD（GitHub Actionsからの自動デプロイ）は未設定
- カスタムドメイン・HTTPS証明書は未設定（API Gatewayのデフォルトエンドポイントをそのまま使用）
- 書き込み系APIには認証が無い。デモ・検証目的の範囲にとどめる
