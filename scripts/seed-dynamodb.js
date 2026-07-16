const path = require('node:path');
const { readCsv } = require('../src/csv');
const db = require('../src/dynamo');

const MASTER_DIR = path.join(__dirname, '..', 'db', 'master');

async function seedGenres() {
  const rows = readCsv(path.join(MASTER_DIR, 'genre_master.csv'));
  for (const row of rows) {
    await db.putGenre({ genre_id: Number(row.genre_id), genre_name: row.genre_name });
  }
  console.log(`genres: ${rows.length}`);
}

async function seedProducts() {
  const rows = readCsv(path.join(MASTER_DIR, 'product_master.csv'));
  for (const row of rows) {
    await db.putProduct({
      product_code: Number(row.product_code),
      product_name: row.product_name,
      genre_id: Number(row.genre_id),
      temp_zone: row.temp_zone,
      container: row.container,
      volume_ml: row.volume_ml !== null ? Number(row.volume_ml) : null,
    });
  }
  console.log(`products: ${rows.length}`);
}

async function seedPriceRevisions() {
  const rows = readCsv(path.join(MASTER_DIR, 'price_revision.csv'));
  for (const row of rows) {
    await db.putPriceRevision({
      revision_id: Number(row.revision_id),
      product_code: Number(row.product_code),
      effective_date: row.effective_date,
      price: row.price !== null ? Number(row.price) : null,
    });
  }
  console.log(`price_revisions: ${rows.length}`);
}

async function seedPurchaseHistory() {
  const rows = readCsv(path.join(MASTER_DIR, 'purchase_history.csv'));
  for (const row of rows) {
    await db.putPurchase({
      purchase_id: Number(row.purchase_id),
      purchase_date: row.purchase_date,
      product_code: Number(row.product_code),
      quantity: Number(row.quantity),
      amount: row.amount !== null ? Number(row.amount) : null,
    });
  }
  console.log(`purchase_history: ${rows.length}`);
}

async function seedStockRecords() {
  const rows = readCsv(path.join(MASTER_DIR, 'stock_record.csv'));
  for (const row of rows) {
    await db.putStockRecord({
      record_id: Number(row.record_id),
      record_date: row.record_date,
      product_code: Number(row.product_code),
      stock_count: Number(row.stock_count),
    });
  }
  console.log(`stock_records: ${rows.length}`);
}

async function main() {
  console.log('DynamoDBへマスタデータを投入します...');
  await seedGenres();
  await seedProducts();
  await seedPriceRevisions();
  await seedPurchaseHistory();
  await seedStockRecords();
  console.log('完了');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
