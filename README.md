# 購買部 食品ロス削減・在庫管理支援システム

購買部の弁当・パン・飲料などの発注を、経験や勘ではなくAIによる需要予測で支援するシステム。売れ残り（食品ロス）と品切れの両方を減らすことが目的。

## デプロイ済みAPI

```
https://1acuynf6vk.execute-api.us-east-1.amazonaws.com
```

AWS Academy Learner Lab上に構築（API Gateway + Lambda + DynamoDB）。**Labセッションが切れるとリソースが消える場合があるため、動かない時は [docs/aws-todo.md](docs/aws-todo.md) の手順で `./deploy/deploy.sh` を再実行してください。**

## 役割分担

| 担当 | 内容 | 詳細 |
| --- | --- | --- |
| ①フロントエンド | 画面（商品一覧・在庫入力・予測結果表示） | [docs/ui-todo.md](docs/ui-todo.md) |
| ②バックエンド（API） | このリポジトリの `src/` 一式・AWSデプロイ | [API.md](API.md) / [docs/aws-todo.md](docs/aws-todo.md) |
| ③データベース | テーブル設計・マスタデータ | [docs/db.md](docs/db.md) |
| ④AI・需要予測 | 推奨購買数量の算出モデル | [docs/ai.md](docs/ai.md) |
| ⑤AWS・インフラ | 本番環境構築（②が一旦実装。相談歓迎） | [docs/aws-todo.md](docs/aws-todo.md) |

## リポジトリ構成

```
kobai-bu-api/
├── README.md
├── API.md               # APIエンドポイント仕様（フロント・AI連携用の契約書）
├── src/                  # APIサーバー本体（Node.js + Express）
│   ├── app.js             # Expressアプリ本体（ローカル・Lambda共通）
│   ├── server.js          # ローカル起動用エントリポイント
│   ├── lambda.js          # Lambda用エントリポイント
│   ├── dynamo.js          # DynamoDBアクセス層
│   ├── csv.js
│   └── routes/
├── deploy/                # AWSデプロイ用スクリプト
│   ├── create-tables.sh    # DynamoDBテーブル作成
│   └── deploy.sh           # Lambda + API Gatewayの作成/更新
├── scripts/
│   └── seed-dynamodb.js    # db/master/*.csv をDynamoDBへ投入
├── db/                    # DB班の成果物
│   ├── er_diagram_final.png
│   └── master/              # マスタCSV
└── ai/                    # AI班の成果物
    ├── purchase_prediction.py
    ├── requirements.txt
    └── *.csv                # 学習用ダミーデータ・予測結果
```

## ローカルでの動かし方

DynamoDB（AWS実データ）に対して動くので、AWS認証情報（`aws configure`）が必要です。

```bash
npm install
export AWS_REGION=us-east-1
npm start
# http://localhost:3000 で起動
```

動作確認: `curl http://localhost:3000/api/health`

起動すると `http://localhost:3000/` に確認用の簡易UI（`public/index.html`）も配信される（商品一覧・在庫/仕入れ記録フォーム・AI推奨発注数の表示）。本番のUIはフロント担当が別途作成する想定。

## AWSへのデプロイ

[docs/aws-todo.md](docs/aws-todo.md) を参照。

## 現在の状態

- API・DynamoDBスキーマ・マスタデータ投入・AWSデプロイまで実装・動作確認済み
- AI予測（`ai/purchase_prediction.py`）はAPIと連携済み（`POST /api/recommendations`）。ただし本番の在庫記録がまだ蓄積されていないため、現状はAI班のダミーデータに基づく参考値（詳細: [docs/ai.md](docs/ai.md)）
- 確認用の簡易UIあり（`public/index.html`）。本番のフロントは未着手

## RDS移行状況

既存APIをDynamoDBからAmazon RDS for PostgreSQLへ段階的に移行中。

移行・デプロイ手順: [docs/rds-migration.md](docs/rds-migration.md)

- `GET /api/products` は `src/postgres.js` を使用するRDS版へ移行済み
- Node.js LambdaとAPI Gatewayを経由した商品一覧取得まで動作確認済み
- その他のAPIは引き続きDynamoDBを使用
- Python版の `purchasing-products-api` は、RDS移行中の比較・検証用として残している

> **注意:** 現在の `deploy/deploy.sh` はDynamoDB版の構築手順であり、RDS用のVPC・環境変数・API Gateway設定を再現しない。RDS対応が完了するまでは、RDS版のデプロイには使用しないこと。
