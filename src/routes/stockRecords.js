const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { product_code, from, to } = req.query;

  let sql = 'SELECT * FROM stock_records WHERE 1=1';
  const params = [];
  if (product_code) {
    sql += ' AND product_code = ?';
    params.push(product_code);
  }
  if (from) {
    sql += ' AND record_date >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND record_date <= ?';
    params.push(to);
  }
  sql += ' ORDER BY record_date DESC';

  res.json(db.prepare(sql).all(...params));
});

// 商品ごとの最新在庫数
router.get('/current', (req, res) => {
  const rows = db.prepare(`
    SELECT sr.product_code, sr.stock_count, sr.record_date
    FROM stock_records sr
    WHERE sr.record_date = (
      SELECT MAX(sr2.record_date) FROM stock_records sr2
      WHERE sr2.product_code = sr.product_code
    )
  `).all();
  res.json(rows);
});

// record_date + product_code が既存なら上書き（UNIQUE制約に対応）
router.post('/', (req, res) => {
  const { record_date, product_code, stock_count } = req.body;
  if (!record_date || !product_code || stock_count == null) {
    return res.status(400).json({ error: 'record_date, product_code, stock_count are required' });
  }

  const product = db.prepare('SELECT product_code FROM products WHERE product_code = ?').get(product_code);
  if (!product) {
    return res.status(404).json({ error: 'product not found' });
  }

  db.prepare(`
    INSERT INTO stock_records (record_date, product_code, stock_count)
    VALUES (?, ?, ?)
    ON CONFLICT (record_date, product_code) DO UPDATE SET stock_count = excluded.stock_count
  `).run(record_date, product_code, stock_count);

  res.status(201).json(
    db.prepare('SELECT * FROM stock_records WHERE record_date = ? AND product_code = ?')
      .get(record_date, product_code)
  );
});

module.exports = router;
