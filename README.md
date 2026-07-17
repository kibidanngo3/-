# 購買部 食品ロス削減・在庫管理支援システム

購買部の弁当・パン・飲料などの発注を、経験や勘ではなくAIによる需要予測で支援するシステム。売れ残り（食品ロス）と品切れの両方を減らすことが目的。

## デプロイ済みAPI

```
RDS版（現行）:            https://vntb888c53.execute-api.us-east-1.amazonaws.com
旧DynamoDB版（ロールバック用）: https://1acuynf6vk.execute-api.us-east-1.amazonaws.com
```

AWS Academy Learner Lab上に構築。**Labセッションが切れるとリソースが消える／認証情報が失効する場合があるため、動かない時は [docs/rds-migration.md](docs/rds-migration.md) を参照して再デプロイしてください。**

## 役割分担

| 担当 | 内容 | 詳細 |
| --- | --- | --- |
| ①フロントエンド | 画面（商品一覧・在庫入力・予測結果表示） | [docs/ui-todo.md](docs/ui-todo.md) |
| ②バックエンド（API） | このリポジトリの `src/` 一式・AWSデプロイ | [API.md](API.md) / [docs/rds-migration.md](docs/rds-migration.md) |
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
│   ├── postgres.js        # RDS(PostgreSQL)アクセス層 ← 現行
│   ├── dynamo.js          # DynamoDBアクセス層 ← ロールバック用に残置
│   ├── csv.js
│   └── routes/
├── scripts/
│   ├── schema.sql              # RDSのテーブル定義
│   ├── init-postgres-schema.js # schema.sqlを適用
│   ├── seed-postgres.js        # db/master/*.csv をRDSへ投入
│   └── seed-dynamodb.js        # （旧）DynamoDB版のシード
├── deploy/                # DynamoDB版のAWSデプロイ用スクリプト（RDS版はdocs/rds-migration.md参照）
│   ├── create-tables.sh
│   └── deploy.sh
├── db/                    # DB班の成果物
│   ├── er_diagram_final.png
│   └── master/              # マスタCSV
└── ai/                    # AI班の成果物
    ├── purchase_prediction.py
    ├── requirements.txt
    └── *.csv                # 学習用ダミーデータ・予測結果
```

## ローカルでの動かし方

RDS(PostgreSQL)に対して動くので、接続情報を環境変数で渡します（`.env.example`参照）。

```bash
npm install
cp .env.example .env   # DB_HOST等を実際のRDSエンドポイントに書き換える
npm run db:init         # テーブル作成（初回のみ）
npm run db:seed         # マスタデータ投入（初回のみ）
npm start
# http://localhost:3000 で起動
```

動作確認: `curl http://localhost:3000/api/health`

起動すると `http://localhost:3000/` に確認用の簡易UI（`public/index.html`）も配信される（商品一覧・在庫/仕入れ記録フォーム・AI推奨発注数の表示）。本番のUIはフロント担当が別途作成する想定。

## AWSへのデプロイ（RDS版）

[docs/rds-migration.md](docs/rds-migration.md) を参照。VPC内のLambda・RDS接続情報の設定が必要なため、DynamoDB版の`deploy/deploy.sh`とは手順が異なる。

## 現在の状態

- 全API（genres / products / price-revisions / purchases / stock-records / recommendations）をRDS(PostgreSQL)へ移行済み
- AI予測（`ai/purchase_prediction.py`）はAPIと連携済み（`POST /api/recommendations`）。ただし本番の在庫記録がまだ蓄積されていないため、現状はAI班のダミーデータに基づく参考値（詳細: [docs/ai.md](docs/ai.md)）
- 確認用の簡易UIあり（`public/index.html`）。本番のフロントは未着手
- DynamoDB版は`src/dynamo.js`・`deploy/`配下にロールバック用として残置
