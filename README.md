# 購買部 食品ロス削減・在庫管理支援システム

購買部の弁当・パン・飲料などの発注を、経験や勘ではなくAIによる需要予測で支援するシステム。売れ残り（食品ロス）と品切れの両方を減らすことが目的。

## 役割分担

| 担当 | 内容 | 詳細 |
| --- | --- | --- |
| ①フロントエンド | 画面（商品一覧・在庫入力・予測結果表示） | [docs/ui-todo.md](docs/ui-todo.md) |
| ②バックエンド（API） | このリポジトリの `src/` 一式 | [API.md](API.md) |
| ③データベース | テーブル設計・マスタデータ | [docs/db.md](docs/db.md) |
| ④AI・需要予測 | 推奨購買数量の算出モデル | [docs/ai.md](docs/ai.md) |
| ⑤AWS・インフラ | 本番環境構築 | [docs/aws-todo.md](docs/aws-todo.md) |

## リポジトリ構成

```
kobai-bu-api/
├── README.md          # このファイル
├── API.md             # APIエンドポイント仕様（フロント・AI連携用の契約書）
├── src/                # APIサーバー本体（Node.js + Express）
│   ├── server.js
│   ├── db.js           # テーブル定義＋マスタCSVの自動シード
│   ├── csv.js
│   └── routes/
├── db/                 # DB班の成果物
│   ├── er_diagram_final.png
│   └── master/          # マスタCSV（起動時にSQLiteへ自動投入）
├── ai/                  # AI班の成果物
│   ├── purchase_prediction.py
│   ├── requirements.txt
│   └── *.csv            # 学習用ダミーデータ・予測結果
└── data/                # 実行時に生成されるSQLiteファイル（gitignore対象）
```

## ローカルでの動かし方

```bash
npm install
npm start
# http://localhost:3000 で起動。初回起動時に db/master/*.csv を自動でSQLiteに取り込む
```

動作確認: `curl http://localhost:3000/api/health`

## 現在の状態

- API・DBスキーマ・マスタデータ投入まで実装・動作確認済み
- AI予測（`ai/purchase_prediction.py`）はまだAPIと未連携（CSV入出力の独立スクリプト）
- フロント・AWS側は未着手
