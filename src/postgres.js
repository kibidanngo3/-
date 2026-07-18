const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false,
    max: Number(process.env.DB_POOL_MAX || 5),
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
});

// recommendations.next_order_date（後から追加したカラム）を未適用の環境に反映する軽量マイグレーション
pool.query(
    'ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS next_order_date DATE'
).catch((err) => {
    console.error('next_order_date migration failed', err);
});

function toDateStr(row, key) {
    if (!row || row[key] == null) return null;
    const d = row[key] instanceof Date ? row[key] : new Date(row[key]);
    return d.toISOString().slice(0, 10);
}

// ============================================================
// Genres
// ============================================================
async function listGenres() {
    const { rows } = await pool.query(
        'SELECT genre_id, genre_name FROM genres ORDER BY genre_id'
    );
    return rows;
}

async function createGenre(genreName) {
    const { rows } = await pool.query(
        `SELECT COALESCE(MAX(genre_id), 0) + 1 AS next_id FROM genres`
    );
    const genreId = rows[0].next_id;
    await pool.query(
        'INSERT INTO genres (genre_id, genre_name) VALUES ($1, $2)',
        [genreId, genreName]
    );
    return { genre_id: genreId, genre_name: genreName };
}

// ============================================================
// Products
// ============================================================
async function listProducts(genreId) {
    const normalizedGenreId =
        genreId == null || genreId === '' ? null : Number(genreId);

    if (
        normalizedGenreId !== null &&
        !Number.isInteger(normalizedGenreId)
    ) {
        throw new Error('genre_id must be an integer');
    }

    const sql = `
    SELECT
      p.product_code,
      p.product_name,
      p.genre_id,
      g.genre_name,
      p.temp_zone,
      p.container,
      p.volume_ml,
      latest_price.price::integer AS current_price,
      TO_CHAR(
        latest_price.effective_date,
        'YYYY-MM-DD'
      ) AS price_effective_date,
      latest_stock.stock_count::integer AS current_stock,
      TO_CHAR(
        latest_stock.record_date,
        'YYYY-MM-DD'
      ) AS stock_recorded_at
    FROM products AS p
    LEFT JOIN genres AS g
      ON g.genre_id = p.genre_id
    LEFT JOIN LATERAL (
      SELECT
        pr.price,
        pr.effective_date
      FROM price_revisions AS pr
      WHERE pr.product_code = p.product_code
      ORDER BY
        pr.effective_date DESC,
        pr.revision_id DESC
      LIMIT 1
    ) AS latest_price ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        sr.stock_count,
        sr.record_date
      FROM stock_records AS sr
      WHERE sr.product_code = p.product_code
      ORDER BY
        sr.record_date DESC,
        sr.record_id DESC
      LIMIT 1
    ) AS latest_stock ON TRUE
    WHERE (
      $1::integer IS NULL
      OR p.genre_id = $1::integer
    )
    ORDER BY p.product_code
  `;

    const { rows } = await pool.query(sql, [normalizedGenreId]);
    return rows;
}

async function getProduct(productCode) {
    const { rows } = await pool.query(
        'SELECT product_code, product_name, genre_id, temp_zone, container, volume_ml FROM products WHERE product_code = $1',
        [Number(productCode)]
    );
    return rows[0] || null;
}

async function createProduct({ product_name, genre_id, temp_zone, container, volume_ml }) {
    const { rows } = await pool.query(
        `SELECT COALESCE(MAX(product_code), 0) + 1 AS next_code FROM products`
    );
    const productCode = rows[0].next_code;
    await pool.query(
        `INSERT INTO products (product_code, product_name, genre_id, temp_zone, container, volume_ml)
     VALUES ($1, $2, $3, $4, $5, $6)`,
        [productCode, product_name, Number(genre_id), temp_zone ?? null, container ?? null, volume_ml ?? null]
    );
    return productCode;
}

async function updateProduct(productCode, fields) {
    const existing = await getProduct(productCode);
    if (!existing) return null;

    const updated = {
        product_name: fields.product_name ?? existing.product_name,
        genre_id: fields.genre_id != null ? Number(fields.genre_id) : existing.genre_id,
        temp_zone: fields.temp_zone ?? existing.temp_zone,
        container: fields.container ?? existing.container,
        volume_ml: fields.volume_ml ?? existing.volume_ml,
    };
    await pool.query(
        `UPDATE products SET product_name = $1, genre_id = $2, temp_zone = $3, container = $4, volume_ml = $5
     WHERE product_code = $6`,
        [updated.product_name, updated.genre_id, updated.temp_zone, updated.container, updated.volume_ml, Number(productCode)]
    );
    return { product_code: Number(productCode), ...updated };
}

async function deleteProduct(productCode) {
    try {
        const { rowCount } = await pool.query(
            'DELETE FROM products WHERE product_code = $1',
            [Number(productCode)]
        );
        return rowCount > 0;
    } catch (err) {
        // 23503 = foreign_key_violation（売値改定履歴・仕入れ履歴・在庫記録・AI推奨のいずれかが紐づいている）
        if (err.code === '23503') {
            const conflictErr = new Error('product has related records and cannot be deleted');
            conflictErr.isConflict = true;
            throw conflictErr;
        }
        throw err;
    }
}

async function productExists(productCode) {
    const { rows } = await pool.query(
        'SELECT 1 FROM products WHERE product_code = $1',
        [Number(productCode)]
    );
    return rows.length > 0;
}

// ============================================================
// Price revisions
// ============================================================
async function listPriceRevisions(productCode) {
    const sql = productCode
        ? 'SELECT revision_id, product_code, TO_CHAR(effective_date, \'YYYY-MM-DD\') AS effective_date, price FROM price_revisions WHERE product_code = $1 ORDER BY effective_date DESC, revision_id DESC'
        : 'SELECT revision_id, product_code, TO_CHAR(effective_date, \'YYYY-MM-DD\') AS effective_date, price FROM price_revisions ORDER BY effective_date DESC, revision_id DESC';
    const { rows } = await pool.query(sql, productCode ? [Number(productCode)] : []);
    return rows;
}

async function createPriceRevision({ product_code, effective_date, price }) {
    const revisionId = Date.now();
    await pool.query(
        'INSERT INTO price_revisions (revision_id, product_code, effective_date, price) VALUES ($1, $2, $3, $4)',
        [revisionId, Number(product_code), effective_date, price ?? null]
    );
    return revisionId;
}

// ============================================================
// Purchase history
// ============================================================
async function listPurchases({ productCode, from, to } = {}) {
    const conditions = [];
    const params = [];
    if (productCode) {
        params.push(Number(productCode));
        conditions.push(`product_code = $${params.length}`);
    }
    if (from) {
        params.push(from);
        conditions.push(`purchase_date >= $${params.length}`);
    }
    if (to) {
        params.push(to);
        conditions.push(`purchase_date <= $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
        `SELECT purchase_id, TO_CHAR(purchase_date, 'YYYY-MM-DD') AS purchase_date, product_code, quantity, amount
     FROM purchase_history ${where} ORDER BY purchase_date DESC, purchase_id DESC`,
        params
    );
    return rows;
}

async function createPurchase({ purchase_date, product_code, quantity, amount }) {
    const purchaseId = Date.now();
    await pool.query(
        'INSERT INTO purchase_history (purchase_id, purchase_date, product_code, quantity, amount) VALUES ($1, $2, $3, $4, $5)',
        [purchaseId, purchase_date, Number(product_code), quantity, amount ?? null]
    );
    return purchaseId;
}

// ============================================================
// Stock records
// ============================================================
async function listStockRecords({ productCode, from, to } = {}) {
    const conditions = [];
    const params = [];
    if (productCode) {
        params.push(Number(productCode));
        conditions.push(`product_code = $${params.length}`);
    }
    if (from) {
        params.push(from);
        conditions.push(`record_date >= $${params.length}`);
    }
    if (to) {
        params.push(to);
        conditions.push(`record_date <= $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
        `SELECT record_id, TO_CHAR(record_date, 'YYYY-MM-DD') AS record_date, product_code, stock_count
     FROM stock_records ${where} ORDER BY record_date DESC, record_id DESC`,
        params
    );
    return rows;
}

async function listCurrentStock() {
    const sql = `
    SELECT DISTINCT ON (product_code)
      product_code, stock_count, TO_CHAR(record_date, 'YYYY-MM-DD') AS record_date
    FROM stock_records
    ORDER BY product_code, record_date DESC, record_id DESC
  `;
    const { rows } = await pool.query(sql);
    return rows;
}

async function upsertStockRecord({ record_date, product_code, stock_count }) {
    const recordId = Date.now();
    const { rows } = await pool.query(
        `INSERT INTO stock_records (record_id, record_date, product_code, stock_count)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (record_date, product_code) DO UPDATE SET stock_count = EXCLUDED.stock_count
     RETURNING record_id, TO_CHAR(record_date, 'YYYY-MM-DD') AS record_date, product_code, stock_count`,
        [recordId, record_date, Number(product_code), stock_count]
    );
    return rows[0];
}

// ============================================================
// AI推奨発注数
// ============================================================
async function listRecommendations() {
    const { rows } = await pool.query(
        `SELECT product_code, current_stock, last_cycle_consumption, predicted_consumption,
            recommended_qty, purchase_needed, TO_CHAR(next_order_date, 'YYYY-MM-DD') AS next_order_date, generated_at
     FROM recommendations ORDER BY recommended_qty DESC`
    );
    return rows;
}

async function upsertRecommendation(rec) {
    await pool.query(
        `INSERT INTO recommendations
       (product_code, current_stock, last_cycle_consumption, predicted_consumption, recommended_qty, purchase_needed, next_order_date, generated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (product_code) DO UPDATE SET
       current_stock = EXCLUDED.current_stock,
       last_cycle_consumption = EXCLUDED.last_cycle_consumption,
       predicted_consumption = EXCLUDED.predicted_consumption,
       recommended_qty = EXCLUDED.recommended_qty,
       purchase_needed = EXCLUDED.purchase_needed,
       next_order_date = EXCLUDED.next_order_date,
       generated_at = now()`,
        [
            Number(rec.product_code),
            rec.current_stock ?? null,
            rec.last_cycle_consumption ?? null,
            rec.predicted_consumption ?? null,
            rec.recommended_qty,
            rec.purchase_needed ?? rec.recommended_qty > 0,
            rec.next_order_date ?? null,
        ]
    );
}

async function closePool() {
    await pool.end();
}

module.exports = {
    listGenres,
    createGenre,
    listProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    productExists,
    listPriceRevisions,
    createPriceRevision,
    listPurchases,
    createPurchase,
    listStockRecords,
    listCurrentStock,
    upsertStockRecord,
    listRecommendations,
    upsertRecommendation,
    closePool,
};
