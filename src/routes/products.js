const express = require('express');
const db = require('../db');

const router = express.Router();

// 商品ごとの最新在庫数・現行売値（price_revisionsの最新行）を含めた一覧
router.get('/', (req, res) => {
  const { genre_id } = req.query;

  let sql = `
    SELECT
      p.product_code, p.product_name, p.genre_id, g.genre_name,
      p.temp_zone, p.container, p.volume_ml,
      latest_price.price AS current_price,
      latest_price.effective_date AS price_effective_date,
      latest_stock.stock_count AS current_stock,
      latest_stock.record_date AS stock_recorded_at
    FROM products p
    JOIN genres g ON g.genre_id = p.genre_id
    LEFT JOIN (
      SELECT pr.product_code, pr.price, pr.effective_date
      FROM price_revisions pr
      WHERE pr.effective_date = (
        SELECT MAX(pr2.effective_date) FROM price_revisions pr2
        WHERE pr2.product_code = pr.product_code
      )
    ) latest_price ON latest_price.product_code = p.product_code
    LEFT JOIN (
      SELECT sr.product_code, sr.stock_count, sr.record_date
      FROM stock_records sr
      WHERE sr.record_date = (
        SELECT MAX(sr2.record_date) FROM stock_records sr2
        WHERE sr2.product_code = sr.product_code
      )
    ) latest_stock ON latest_stock.product_code = p.product_code
  `;
  const params = [];
  if (genre_id) {
    sql += ' WHERE p.genre_id = ?';
    params.push(genre_id);
  }
  sql += ' ORDER BY p.product_code';

  res.json(db.prepare(sql).all(...params));
});

router.get('/:code', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE product_code = ?').get(req.params.code);
  if (!product) {
    return res.status(404).json({ error: 'product not found' });
  }
  const priceHistory = db.prepare(
    'SELECT * FROM price_revisions WHERE product_code = ? ORDER BY effective_date DESC'
  ).all(req.params.code);

  res.json({ ...product, current_price: priceHistory[0]?.price ?? null, price_history: priceHistory });
});

router.post('/', (req, res) => {
  const { product_name, genre_id, temp_zone, container, volume_ml, price, effective_date } = req.body;
  if (!product_name || !genre_id) {
    return res.status(400).json({ error: 'product_name and genre_id are required' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO products (product_name, genre_id, temp_zone, container, volume_ml)
      VALUES (?, ?, ?, ?, ?)
    `).run(product_name, genre_id, temp_zone ?? null, container ?? null, volume_ml ?? null);
    const productCode = Number(result.lastInsertRowid);

    if (price != null) {
      db.prepare(`
        INSERT INTO price_revisions (product_code, effective_date, price) VALUES (?, ?, ?)
      `).run(productCode, effective_date ?? new Date().toISOString().slice(0, 10), price);
    }

    res.status(201).json({ product_code: productCode });
  } catch (err) {
    res.status(409).json({ error: 'product_name already exists' });
  }
});

router.put('/:code', (req, res) => {
  const { product_name, genre_id, temp_zone, container, volume_ml } = req.body;
  const existing = db.prepare('SELECT * FROM products WHERE product_code = ?').get(req.params.code);
  if (!existing) {
    return res.status(404).json({ error: 'product not found' });
  }

  db.prepare(`
    UPDATE products SET
      product_name = ?,
      genre_id = ?,
      temp_zone = ?,
      container = ?,
      volume_ml = ?
    WHERE product_code = ?
  `).run(
    product_name ?? existing.product_name,
    genre_id ?? existing.genre_id,
    temp_zone ?? existing.temp_zone,
    container ?? existing.container,
    volume_ml ?? existing.volume_ml,
    req.params.code
  );

  res.json(db.prepare('SELECT * FROM products WHERE product_code = ?').get(req.params.code));
});

router.delete('/:code', (req, res) => {
  const result = db.prepare('DELETE FROM products WHERE product_code = ?').run(req.params.code);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'product not found' });
  }
  res.status(204).send();
});

module.exports = router;
