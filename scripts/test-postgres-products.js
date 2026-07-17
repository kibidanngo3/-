const postgres = require('../src/postgres');

async function main() {
  try {
    const products = await postgres.listProducts();
    console.log(`RDS connection OK: ${products.length} products`);

    if (products.length > 0) {
      console.log('First product fields:', Object.keys(products[0]).join(', '));
    }
  } finally {
    await postgres.closePool();
  }
}

main().catch((err) => {
  console.error('RDS product test failed:', err.message);
  process.exitCode = 1;
});
