const express = require('express');
const db = require('../dynamo');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await db.listPriceRevisions(req.query.product_code));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { product_code, effective_date, price } = req.body;
    if (!product_code || !effective_date) {
      return res.status(400).json({ error: 'product_code and effective_date are required' });
    }

    const product = await db.getProduct(product_code);
    if (!product) {
      return res.status(404).json({ error: 'product not found' });
    }

    const revision_id = Date.now();
    await db.putPriceRevision({
      revision_id,
      product_code: Number(product_code),
      effective_date,
      price: price ?? null,
    });
    res.status(201).json({ revision_id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
