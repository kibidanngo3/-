const express = require('express');
const db = require('../postgres');

const router = express.Router();

// AI班の推奨購買数量一覧（推奨数量が多い順）
router.get('/', async (req, res, next) => {
  try {
    res.json(await db.listRecommendations());
  } catch (err) {
    next(err);
  }
});

// AI班のバッチスクリプトが算出結果をまとめて書き込む
router.post('/', async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items (array) is required' });
    }

    for (const item of items) {
      if (item.product_code == null || item.recommended_qty == null) {
        return res.status(400).json({ error: 'product_code and recommended_qty are required for each item' });
      }
      await db.upsertRecommendation(item);
    }

    res.status(201).json({ saved: items.length, generated_at: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
