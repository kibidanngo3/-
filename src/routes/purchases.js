const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { product_code, from, to } = req.query;

  let sql = 'SELECT * FROM purchase_history WHERE 1=1';
  const params = [];
  if (product_code) {
    sql += ' AND product_code = ?';
    params.push(product_code);
  }
  if (from) {
    sql += ' AND purchase_date >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND purchase_date <= ?';
    params.push(to);
  }
  sql += ' ORDER BY purchase_date DESC';

  res.json(db.prepare(sql).all(...params));
});

router.post('/', (req, res) => {
  const { purchase_date, product_code, quantity, amount } = req.body;
  if (!purchase_date || !product_code || quantity == null) {
    return res.status(400).json({ error: 'purchase_date, product_code, quantity are required' });
  }

  const product = db.prepare('SELECT product_code FROM products WHERE product_code = ?').get(product_code);
  if (!product) {
    return res.status(404).json({ error: 'product not found' });
  }

  const result = db.prepare(
    'INSERT INTO purchase_history (purchase_date, product_code, quantity, amount) VALUES (?, ?, ?, ?)'
  ).run(purchase_date, product_code, quantity, amount ?? null);

  res.status(201).json({ purchase_id: Number(result.lastInsertRowid) });
});

module.exports = router;
