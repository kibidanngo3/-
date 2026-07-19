const express = require('express');
const db = require('../postgres');

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

    if (price != null && (typeof price !== 'number' || Number.isNaN(price) || price < 0)) {
      return res.status(400).json({ error: 'price must be 0 or greater' });
    }

    if (!(await db.productExists(product_code))) {
      return res.status(404).json({ error: 'product not found' });
    }

    const revision_id = await db.createPriceRevision({ product_code, effective_date, price });
    res.status(201).json({ revision_id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
