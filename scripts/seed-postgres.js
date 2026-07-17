// DB班のマスタCSVをRDS(PostgreSQL)に投入する（既存分はスキップ、冪等）
const path = require('node:path');
const { Pool } = require('pg');
const { readCsv } = require('../src/csv');

const MASTER_DIR = path.join(__dirname, '..', 'db', 'master');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function seedGenres() {
  const rows = readCsv(path.join(MASTER_DIR, 'genre_master.csv'));
  for (const row of rows) {
    await pool.query(
      'INSERT INTO genres (genre_id, genre_name) VALUES ($1, $2) ON CONFLICT (genre_id) DO NOTHING',
      [Number(row.genre_id), row.genre_name]
    );
  }
  console.log(`genres: ${rows.length}`);
}

async function seedProducts() {
  const rows = readCsv(path.join(MASTER_DIR, 'product_master.csv'));
  for (const row of rows) {
    await pool.query(
      `INSERT INTO products (product_code, product_name, genre_id, temp_zone, container, volume_ml)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (product_code) DO NOTHING`,
      [
        Number(row.product_code),
        row.product_name,
        Number(row.genre_id),
        row.temp_zone,
        row.container,
        row.volume_ml !== null ? Number(row.volume_ml) : null,
      ]
    );
  }
  console.log(`products: ${rows.length}`);
}

async function seedPriceRevisions() {
  const rows = readCsv(path.join(MASTER_DIR, 'price_revision.csv'));
  for (const row of rows) {
    await pool.query(
      `INSERT INTO price_revisions (revision_id, product_code, effective_date, price)
       VALUES ($1, $2, $3, $4) ON CONFLICT (revision_id) DO NOTHING`,
      [
        Number(row.revision_id),
        Number(row.product_code),
        row.effective_date,
        row.price !== null ? Number(row.price) : null,
      ]
    );
  }
  console.log(`price_revisions: ${rows.length}`);
}

async function seedPurchaseHistory() {
  const rows = readCsv(path.join(MASTER_DIR, 'purchase_history.csv'));
  for (const row of rows) {
    await pool.query(
      `INSERT INTO purchase_history (purchase_id, purchase_date, product_code, quantity, amount)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (purchase_id) DO NOTHING`,
      [
        Number(row.purchase_id),
        row.purchase_date,
        Number(row.product_code),
        Number(row.quantity),
        row.amount !== null ? Number(row.amount) : null,
      ]
    );
  }
  console.log(`purchase_history: ${rows.length}`);
}

async function seedStockRecords() {
  const rows = readCsv(path.join(MASTER_DIR, 'stock_record.csv'));
  for (const row of rows) {
    await pool.query(
      `INSERT INTO stock_records (record_id, record_date, product_code, stock_count)
       VALUES ($1, $2, $3, $4) ON CONFLICT (record_id) DO NOTHING`,
      [Number(row.record_id), row.record_date, Number(row.product_code), Number(row.stock_count)]
    );
  }
  console.log(`stock_records: ${rows.length}`);
}

async function main() {
  console.log('RDS(PostgreSQL)へマスタデータを投入します...');
  await seedGenres();
  await seedProducts();
  await seedPriceRevisions();
  await seedPurchaseHistory();
  await seedStockRecords();
  console.log('完了');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
