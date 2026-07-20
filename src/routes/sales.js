const express = require('express');
const db = require('../postgres');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { product_code, from, to } = req.query;
    res.json(await db.listSales({ productCode: product_code, from, to }));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { sale_date, product_code, quantity } = req.body;
    if (!sale_date || !product_code || quantity == null) {
      return res.status(400).json({ error: 'sale_date, product_code, quantity are required' });
    }

    if (typeof quantity !== 'number' || Number.isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'quantity must be greater than 0' });
    }

    if (!(await db.productExists(product_code))) {
      return res.status(404).json({ error: 'product not found' });
    }

    const sale_id = await db.createSale({ sale_date, product_code, quantity });
    res.status(201).json({ sale_id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
