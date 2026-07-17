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

async function closePool() {
    await pool.end();
}

module.exports = {
    listProducts,
    closePool,
};