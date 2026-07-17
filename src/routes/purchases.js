const express = require('express');
const db = require('../postgres');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { product_code, from, to } = req.query;
    res.json(await db.listPurchases({ productCode: product_code, from, to }));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { purchase_date, product_code, quantity, amount } = req.body;
    if (!purchase_date || !product_code || quantity == null) {
      return res.status(400).json({ error: 'purchase_date, product_code, quantity are required' });
    }

    if (!(await db.productExists(product_code))) {
      return res.status(404).json({ error: 'product not found' });
    }

    const purchase_id = await db.createPurchase({ purchase_date, product_code, quantity, amount });
    res.status(201).json({ purchase_id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
