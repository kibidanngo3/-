const express = require('express');
const db = require('../dynamo');

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

    const generated_at = new Date().toISOString();
    for (const item of items) {
      const { product_code, current_stock, last_cycle_consumption, predicted_consumption, recommended_qty, purchase_needed } = item;
      if (product_code == null || recommended_qty == null) {
        return res.status(400).json({ error: 'product_code and recommended_qty are required for each item' });
      }
      await db.putRecommendation({
        product_code: Number(product_code),
        current_stock: current_stock ?? null,
        last_cycle_consumption: last_cycle_consumption ?? null,
        predicted_consumption: predicted_consumption ?? null,
        recommended_qty,
        purchase_needed: purchase_needed ?? recommended_qty > 0,
        generated_at,
      });
    }

    res.status(201).json({ saved: items.length, generated_at });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
