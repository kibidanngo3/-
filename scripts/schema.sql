-- 購買部在庫管理システム PostgreSQL(RDS)スキーマ
-- 冪等（既存環境に対して再実行しても壊れない）

CREATE TABLE IF NOT EXISTS genres (
  genre_id    INTEGER PRIMARY KEY,
  genre_name  VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
  product_code   INTEGER PRIMARY KEY,
  product_name   VARCHAR(200) NOT NULL UNIQUE,
  genre_id       INTEGER NOT NULL REFERENCES genres(genre_id),
  temp_zone      VARCHAR(20),
  container      VARCHAR(20),
  volume_ml      INTEGER
);

CREATE TABLE IF NOT EXISTS price_revisions (
  revision_id     BIGINT PRIMARY KEY,
  product_code    INTEGER NOT NULL REFERENCES products(product_code),
  effective_date  DATE NOT NULL,
  price           INTEGER
);
CREATE INDEX IF NOT EXISTS idx_price_revisions_product ON price_revisions(product_code, effective_date DESC);

CREATE TABLE IF NOT EXISTS purchase_history (
  purchase_id    BIGINT PRIMARY KEY,
  purchase_date  DATE NOT NULL,
  product_code   INTEGER NOT NULL REFERENCES products(product_code),
  quantity       INTEGER NOT NULL,
  amount         INTEGER
);
CREATE INDEX IF NOT EXISTS idx_purchase_history_product ON purchase_history(product_code, purchase_date DESC);

CREATE TABLE IF NOT EXISTS stock_records (
  record_id     BIGINT PRIMARY KEY,
  record_date   DATE NOT NULL,
  product_code  INTEGER NOT NULL REFERENCES products(product_code),
  stock_count   INTEGER NOT NULL,
  UNIQUE (record_date, product_code)
);
CREATE INDEX IF NOT EXISTS idx_stock_records_product ON stock_records(product_code, record_date DESC);

CREATE TABLE IF NOT EXISTS sales (
  sale_id       BIGINT PRIMARY KEY,
  sale_date     DATE NOT NULL,
  product_code  INTEGER NOT NULL REFERENCES products(product_code),
  quantity      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sales_product ON sales(product_code, sale_date DESC);

CREATE TABLE IF NOT EXISTS recommendations (
  product_code            INTEGER PRIMARY KEY REFERENCES products(product_code),
  current_stock           INTEGER,
  last_cycle_consumption  NUMERIC,
  predicted_consumption   NUMERIC,
  recommended_qty         INTEGER NOT NULL,
  purchase_needed         BOOLEAN NOT NULL DEFAULT FALSE,
  next_order_date         DATE,
  generated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS next_order_date DATE;
