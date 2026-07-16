# DB情報

## ER図（最終版）

`db/er_diagram_final.png` を参照。テーブルは5つ。

| テーブル | 役割 | 主なカラム |
| --- | --- | --- |
| `genres`（ジャンルマスタ） | 商品ジャンル | `genre_id` PK, `genre_name` |
| `products`（商品マスタ） | 商品の基本情報 | `product_code` PK, `product_name`, `genre_id` FK, `temp_zone`（常温/冷蔵/冷凍）, `container`（缶/PET・飲料のみ）, `volume_ml`（飲料のみ） |
| `price_revisions`（売値改定履歴） | 値段の変更履歴 | `revision_id` PK, `product_code` FK, `effective_date`, `price` |
| `purchase_history`（仕入れ履歴） | 仕入れの記録 | `purchase_id` PK, `purchase_date`, `product_code` FK, `quantity`, `amount` |
| `stock_records`（在庫変動記録） | 在庫数の定点記録 | `record_id` PK, `record_date`, `product_code` FK, `stock_count`（`record_date`+`product_code`でユニーク） |

### 設計上のポイント（Discordでの議論を踏まえた確定事項）

- **飲料属性は別テーブルにせず商品マスタに統合**（`container` / `volume_ml`。飲料以外は `NULL`）
- **現行売値は単一カラムではなく `price_revisions` の最新行から導出**（値段変動に対応するため）
- 在庫記録は**日単位**（時間単位化は運用負荷が大きいため見送り）
- 賞味期限・消費期限カラムは**無し**（対象商品が冷凍食品・カップ麺中心のため）
- 「売り切れ」か「需要が無かっただけ」かの判別は、`stock_records` の直前値が0かどうかで後から判定する想定（専用カラムは持たない）

## マスタCSV（`db/master/`）

サーバー起動時（`src/db.js`）に自動でSQLiteへ取り込まれる（`INSERT OR IGNORE` なので再起動しても重複しない）。

| ファイル | 対応テーブル | 件数 |
| --- | --- | --- |
| `genre_master.csv` | `genres` | 9件 |
| `product_master.csv` | `products` | 48件 |
| `price_revision.csv` | `price_revisions` | 48件（一部 `price` 欠損あり＝要確認） |
| `purchase_history.csv` | `purchase_history` | 94件（2025-01-09〜） |
| `stock_record.csv` | `stock_records` | 0件（ヘッダーのみ、実データ未投入） |

### 確認したい点

- `price_revision.csv` の一部商品（product_code: 9, 12, 19, 30, 31, 32, 40, 43）で `price` が空欄。未設定なのか欠損データなのか確認したい
- `stock_record.csv` が空。実際の在庫記録運用が始まったらここに追記していく想定で合っているか
