const express = require('express');
const db = require('../dynamo');

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

    const product = await db.getProduct(product_code);
    if (!product) {
      return res.status(404).json({ error: 'product not found' });
    }

    const purchase_id = Date.now();
    await db.putPurchase({
      purchase_id,
      purchase_date,
      product_code: Number(product_code),
      quantity,
      amount: amount ?? null,
    });
    res.status(201).json({ purchase_id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
