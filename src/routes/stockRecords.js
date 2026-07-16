const express = require('express');
const db = require('../dynamo');

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

    const product = await db.getProduct(product_code);
    if (!product) {
      return res.status(404).json({ error: 'product not found' });
    }

    const record_id = Date.now();
    const record = { record_id, record_date, product_code: Number(product_code), stock_count };
    await db.putStockRecord(record);
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
