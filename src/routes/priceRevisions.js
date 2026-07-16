const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { product_code } = req.query;

  let sql = 'SELECT * FROM price_revisions WHERE 1=1';
  const params = [];
  if (product_code) {
    sql += ' AND product_code = ?';
    params.push(product_code);
  }
  sql += ' ORDER BY effective_date DESC';

  res.json(db.prepare(sql).all(...params));
});

// 売値改定を1件追加（現行売値は最新のeffective_dateの行から導出される）
router.post('/', (req, res) => {
  const { product_code, effective_date, price } = req.body;
  if (!product_code || !effective_date) {
    return res.status(400).json({ error: 'product_code and effective_date are required' });
  }

  const product = db.prepare('SELECT product_code FROM products WHERE product_code = ?').get(product_code);
  if (!product) {
    return res.status(404).json({ error: 'product not found' });
  }

  const result = db.prepare(`
    INSERT INTO price_revisions (product_code, effective_date, price) VALUES (?, ?, ?)
  `).run(product_code, effective_date, price ?? null);

  res.status(201).json({ revision_id: Number(result.lastInsertRowid) });
});

module.exports = router;
