const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const { readCsv } = require('./csv');

const ROOT = path.join(__dirname, '..');
const MASTER_DIR = path.join(ROOT, 'db', 'master');
const dbPath = path.join(ROOT, 'data', 'kobai.db');
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA foreign_keys = ON;');

// ER図（最終版）に対応するスキーマ
db.exec(`
  CREATE TABLE IF NOT EXISTS genres (
    genre_id    INTEGER PRIMARY KEY,
    genre_name  TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS products (
    product_code   INTEGER PRIMARY KEY,
    product_name   TEXT NOT NULL UNIQUE,
    genre_id       INTEGER NOT NULL,
    temp_zone      TEXT,
    container      TEXT,
    volume_ml      INTEGER,
    FOREIGN KEY (genre_id) REFERENCES genres(genre_id)
  );

  CREATE TABLE IF NOT EXISTS price_revisions (
    revision_id     INTEGER PRIMARY KEY,
    product_code    INTEGER NOT NULL,
    effective_date  TEXT NOT NULL,
    price           INTEGER,
    FOREIGN KEY (product_code) REFERENCES products(product_code)
  );

  CREATE TABLE IF NOT EXISTS purchase_history (
    purchase_id    INTEGER PRIMARY KEY,
    purchase_date  TEXT NOT NULL,
    product_code   INTEGER NOT NULL,
    quantity       INTEGER NOT NULL,
    amount         INTEGER,
    FOREIGN KEY (product_code) REFERENCES products(product_code)
  );

  CREATE TABLE IF NOT EXISTS stock_records (
    record_id     INTEGER PRIMARY KEY,
    record_date   TEXT NOT NULL,
    product_code  INTEGER NOT NULL,
    stock_count   INTEGER NOT NULL,
    UNIQUE (record_date, product_code),
    FOREIGN KEY (product_code) REFERENCES products(product_code)
  );
`);

// DB班提供のマスタCSVから初期データを投入（既存分はスキップ）
function seedFromCsv() {
  const insertGenre = db.prepare('INSERT OR IGNORE INTO genres (genre_id, genre_name) VALUES (?, ?)');
  for (const row of readCsv(path.join(MASTER_DIR, 'genre_master.csv'))) {
    insertGenre.run(Number(row.genre_id), row.genre_name);
  }

  const insertProduct = db.prepare(`
    INSERT OR IGNORE INTO products (product_code, product_name, genre_id, temp_zone, container, volume_ml)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const row of readCsv(path.join(MASTER_DIR, 'product_master.csv'))) {
    insertProduct.run(
      Number(row.product_code),
      row.product_name,
      Number(row.genre_id),
      row.temp_zone,
      row.container,
      row.volume_ml !== null ? Number(row.volume_ml) : null
    );
  }

  const insertPriceRevision = db.prepare(`
    INSERT OR IGNORE INTO price_revisions (revision_id, product_code, effective_date, price)
    VALUES (?, ?, ?, ?)
  `);
  for (const row of readCsv(path.join(MASTER_DIR, 'price_revision.csv'))) {
    insertPriceRevision.run(
      Number(row.revision_id),
      Number(row.product_code),
      row.effective_date,
      row.price !== null ? Number(row.price) : null
    );
  }

  const insertPurchase = db.prepare(`
    INSERT OR IGNORE INTO purchase_history (purchase_id, purchase_date, product_code, quantity, amount)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const row of readCsv(path.join(MASTER_DIR, 'purchase_history.csv'))) {
    insertPurchase.run(
      Number(row.purchase_id),
      row.purchase_date,
      Number(row.product_code),
      Number(row.quantity),
      row.amount !== null ? Number(row.amount) : null
    );
  }

  const insertStock = db.prepare(`
    INSERT OR IGNORE INTO stock_records (record_id, record_date, product_code, stock_count)
    VALUES (?, ?, ?, ?)
  `);
  for (const row of readCsv(path.join(MASTER_DIR, 'stock_record.csv'))) {
    insertStock.run(
      Number(row.record_id),
      row.record_date,
      Number(row.product_code),
      Number(row.stock_count)
    );
  }
}

seedFromCsv();

module.exports = db;
