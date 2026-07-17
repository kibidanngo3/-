const express = require('express');
const db = require('../postgres');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { product_code, from, to } = req.query;
    res.json(await db.listStockRecords({ productCode: product_code, from, to }));
  } catch (err) {
    next(err);
  }
});

router.get('/current', async (req, res, next) => {
  try {
    res.json(await db.listCurrentStock());
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { record_date, product_code, stock_count } = req.body;
    if (!record_date || !product_code || stock_count == null) {
      return res.status(400).json({ error: 'record_date, product_code, stock_count are required' });
    }

    if (!(await db.productExists(product_code))) {
      return res.status(404).json({ error: 'product not found' });
    }

    const record = await db.upsertStockRecord({ record_date, product_code, stock_count });
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
