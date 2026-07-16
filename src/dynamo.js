const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const doc = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLES = {
  genres: process.env.GENRES_TABLE || 'kobai-genres',
  products: process.env.PRODUCTS_TABLE || 'kobai-products',
  priceRevisions: process.env.PRICE_REVISIONS_TABLE || 'kobai-price-revisions',
  purchaseHistory: process.env.PURCHASE_HISTORY_TABLE || 'kobai-purchase-history',
  stockRecords: process.env.STOCK_RECORDS_TABLE || 'kobai-stock-records',
  recommendations: process.env.RECOMMENDATIONS_TABLE || 'kobai-recommendations',
};

// ============================================================
// Genres
// ============================================================
async function listGenres() {
  const { Items } = await doc.send(new ScanCommand({ TableName: TABLES.genres }));
  return (Items || []).sort((a, b) => a.genre_id - b.genre_id);
}

async function putGenre(genre) {
  await doc.send(new PutCommand({ TableName: TABLES.genres, Item: genre }));
}

async function getGenre(genreId) {
  const { Item } = await doc.send(new GetCommand({ TableName: TABLES.genres, Key: { genre_id: Number(genreId) } }));
  return Item || null;
}

// ============================================================
// Products
// ============================================================
async function listProducts(genreId) {
  if (genreId) {
    const { Items } = await doc.send(new QueryCommand({
      TableName: TABLES.products,
      IndexName: 'genre-index',
      KeyConditionExpression: 'genre_id = :g',
      ExpressionAttributeValues: { ':g': Number(genreId) },
    }));
    return (Items || []).sort((a, b) => a.product_code - b.product_code);
  }
  const { Items } = await doc.send(new ScanCommand({ TableName: TABLES.products }));
  return (Items || []).sort((a, b) => a.product_code - b.product_code);
}

async function getProduct(productCode) {
  const { Item } = await doc.send(new GetCommand({
    TableName: TABLES.products,
    Key: { product_code: Number(productCode) },
  }));
  return Item || null;
}

async function putProduct(product) {
  await doc.send(new PutCommand({ TableName: TABLES.products, Item: product }));
}

async function deleteProduct(productCode) {
  await doc.send(new DeleteCommand({ TableName: TABLES.products, Key: { product_code: Number(productCode) } }));
}

// ============================================================
// Price revisions（PK: product_code, SK: effective_date）
// ============================================================
async function listPriceRevisions(productCode) {
  if (productCode) {
    const { Items } = await doc.send(new QueryCommand({
      TableName: TABLES.priceRevisions,
      KeyConditionExpression: 'product_code = :p',
      ExpressionAttributeValues: { ':p': Number(productCode) },
      ScanIndexForward: false,
    }));
    return Items || [];
  }
  const { Items } = await doc.send(new ScanCommand({ TableName: TABLES.priceRevisions }));
  return (Items || []).sort((a, b) => (a.effective_date < b.effective_date ? 1 : -1));
}

async function getLatestPriceRevision(productCode) {
  const { Items } = await doc.send(new QueryCommand({
    TableName: TABLES.priceRevisions,
    KeyConditionExpression: 'product_code = :p',
    ExpressionAttributeValues: { ':p': Number(productCode) },
    ScanIndexForward: false,
    Limit: 1,
  }));
  return (Items && Items[0]) || null;
}

async function putPriceRevision(revision) {
  await doc.send(new PutCommand({ TableName: TABLES.priceRevisions, Item: revision }));
}

// ============================================================
// Purchase history（PK: product_code, SK: purchase_date#purchase_id）
// ============================================================
async function listPurchases({ productCode, from, to } = {}) {
  let items;
  if (productCode) {
    const { Items } = await doc.send(new QueryCommand({
      TableName: TABLES.purchaseHistory,
      KeyConditionExpression: 'product_code = :p',
      ExpressionAttributeValues: { ':p': Number(productCode) },
      ScanIndexForward: false,
    }));
    items = Items || [];
  } else {
    const { Items } = await doc.send(new ScanCommand({ TableName: TABLES.purchaseHistory }));
    items = Items || [];
  }
  if (from) items = items.filter((i) => i.purchase_date >= from);
  if (to) items = items.filter((i) => i.purchase_date <= to);
  return items.sort((a, b) => (a.purchase_date < b.purchase_date ? 1 : -1));
}

async function putPurchase(purchase) {
  await doc.send(new PutCommand({
    TableName: TABLES.purchaseHistory,
    Item: { ...purchase, sort_key: `${purchase.purchase_date}#${purchase.purchase_id}` },
  }));
}

// ============================================================
// Stock records（PK: product_code, SK: record_date）
// ============================================================
async function listStockRecords({ productCode, from, to } = {}) {
  let items;
  if (productCode) {
    const { Items } = await doc.send(new QueryCommand({
      TableName: TABLES.stockRecords,
      KeyConditionExpression: 'product_code = :p',
      ExpressionAttributeValues: { ':p': Number(productCode) },
      ScanIndexForward: false,
    }));
    items = Items || [];
  } else {
    const { Items } = await doc.send(new ScanCommand({ TableName: TABLES.stockRecords }));
    items = Items || [];
  }
  if (from) items = items.filter((i) => i.record_date >= from);
  if (to) items = items.filter((i) => i.record_date <= to);
  return items.sort((a, b) => (a.record_date < b.record_date ? 1 : -1));
}

async function getLatestStockRecord(productCode) {
  const { Items } = await doc.send(new QueryCommand({
    TableName: TABLES.stockRecords,
    KeyConditionExpression: 'product_code = :p',
    ExpressionAttributeValues: { ':p': Number(productCode) },
    ScanIndexForward: false,
    Limit: 1,
  }));
  return (Items && Items[0]) || null;
}

async function listCurrentStock() {
  const products = await listProducts();
  const results = await Promise.all(products.map(async (p) => {
    const latest = await getLatestStockRecord(p.product_code);
    return latest;
  }));
  return results.filter(Boolean);
}

async function putStockRecord(record) {
  await doc.send(new PutCommand({ TableName: TABLES.stockRecords, Item: record }));
}

// ============================================================
// AI推奨購買数量（PK: product_code、AI班のバッチが書き込む）
// ============================================================
async function listRecommendations() {
  const { Items } = await doc.send(new ScanCommand({ TableName: TABLES.recommendations }));
  return (Items || []).sort((a, b) => b.recommended_qty - a.recommended_qty);
}

async function putRecommendation(rec) {
  await doc.send(new PutCommand({ TableName: TABLES.recommendations, Item: rec }));
}

module.exports = {
  TABLES,
  listRecommendations,
  putRecommendation,
  listGenres,
  putGenre,
  getGenre,
  listProducts,
  getProduct,
  putProduct,
  deleteProduct,
  listPriceRevisions,
  getLatestPriceRevision,
  putPriceRevision,
  listPurchases,
  putPurchase,
  listStockRecords,
  getLatestStockRecord,
  listCurrentStock,
  putStockRecord,
};
