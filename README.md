# 購買部 食品ロス削減・在庫管理支援システム

購買部の弁当・パン・飲料などの発注を、経験や勘ではなくAIによる需要予測で支援するシステム。売れ残り（食品ロス）と品切れの両方を減らすことが目的。

## デプロイ済みAPI

```
https://1acuynf6vk.execute-api.us-east-1.amazonaws.com
```

Lambda（VPC内）→ Amazon RDS for PostgreSQL（`kobai-bu-rds`）構成で本番稼働中。AWS Academy Learner Lab上に構築。**Labセッションが切れるとリソースが消える／認証情報が失効する場合があるため、動かない時は [docs/rds-migration.md](docs/rds-migration.md) を参照して再デプロイしてください。**

## 役割分担

「誰が・どのフォルダを触るか」で分けている。担当外のフォルダを触る場合は一声かけると衝突しにくい。

| 担当 | 触るフォルダ・ファイル | 進捗 | ドキュメント |
| --- | --- | --- | --- |
| ① フロントエンド | （本番画面はまだ無い。新規に作る場合は `frontend/` 等を想定） | **未着手** | [docs/ui-todo.md](docs/ui-todo.md) |
| ② バックエンド（API） | `src/`（API本体）、`public/index.html`（確認用UI）、`docs/API.md` | 実装・本番デプロイ済み | [docs/API.md](docs/API.md) |
| ③ データベース | `db/`（ER図・マスタCSV） | マスタデータ投入済み | [docs/db.md](docs/db.md) |
| ④ AI・需要予測 | `ai/`（予測スクリプト・学習データ） | 実装済み、APIと連携済み | [docs/ai.md](docs/ai.md) |
| ⑤ AWS・インフラ | `deploy/`、`scripts/`（DB初期化・デプロイ） | 実装・本番デプロイ済み | [docs/aws-todo.md](docs/aws-todo.md) / [docs/rds-migration.md](docs/rds-migration.md) |

> **③④以外は現状すべて②が兼任で実装している。** DB設計・AWS構築とも本来は③⑤の担当だが、手が空いていたため②が代行した。担当者が着手し直す場合はいつでも引き継ぎ歓迎（各`docs/*.md`に現状と申し送りをまとめてある）。
>
> `public/index.html` はあくまで②が動作確認のために作った仮画面。①が本番画面を作る際は自由に置き換えて構わない。

## リポジトリ構成

```
kobai-bu-api/
├── README.md
├── docs/
│   ├── API.md              # APIエンドポイント仕様（フロント・AI連携用の契約書）
│   ├── db.md                 # DB班向け
│   ├── ai.md                  # AI班向け
│   ├── ui-todo.md              # フロント班向け
│   ├── aws-todo.md              # AWS班向け
│   └── rds-migration.md          # RDS移行の手順・トラブルシューティング
├── src/                  # APIサーバー本体（Node.js + Express）
│   ├── app.js             # Expressアプリ本体（ローカル・Lambda共通）
│   ├── server.js          # ローカル起動用エントリポイント
│   ├── lambda.js          # Lambda用エントリポイント
│   ├── postgres.js        # RDS(PostgreSQL)アクセス層
│   ├── csv.js
│   └── routes/
├── scripts/
│   ├── schema.sql              # RDSのテーブル定義
│   ├── init-postgres-schema.js # schema.sqlを適用
│   └── seed-postgres.js        # db/master/*.csv をRDSへ投入
├── deploy/
│   ├── create-rds.sh       # RDSインスタンス・VPC関連リソースの作成
│   └── deploy-rds.sh       # Lambda（VPC内）+ API Gatewayのデプロイ
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

```bash
export DB_MASTER_PASSWORD=<新規作成時のみ>
./deploy/create-rds.sh   # RDSインスタンス作成（既存なら何もしない）。DB_HOSTを出力
export DB_HOST=<create-rds.shの出力> DB_USER=kobaiadmin DB_PASSWORD=<同上>
npm run db:init && npm run db:seed
./deploy/deploy-rds.sh   # Lambda（VPC内）+ API Gatewayをデプロイ/更新
```

詳細・トラブルシューティングは [docs/rds-migration.md](docs/rds-migration.md) を参照。

## 現在の状態

- 全API（genres / products / price-revisions / purchases / stock-records / recommendations）をRDS(PostgreSQL)へ移行し、**Lambda（VPC内）→ RDSの本番構成で動作確認済み**
- RDSは`kobai-bu-rds`（us-east-1、default VPC）。セキュリティグループはLambda用SGからの5432のみ許可（インターネットには公開していない）
- AI予測（`ai/purchase_prediction.py`）はAPIと連携済み（`POST /api/recommendations`）。ただし本番の在庫記録がまだ蓄積されていないため、現状はAI班のダミーデータに基づく参考値（詳細: [docs/ai.md](docs/ai.md)）
- 確認用の簡易UIあり（`public/index.html`）。本番のフロントは未着手
- DynamoDB版のコード・AWS上のテーブルは移行完了に伴い削除済み
