const express = require('express');
const db = require('../dynamo');
const postgres = require('../postgres');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { genre_id } = req.query;
    const products = await postgres.listProducts(genre_id);
    res.json(products);
  } catch (err) {
    next(err);
  }
});

router.get('/:code', async (req, res, next) => {
  try {
    const product = await db.getProduct(req.params.code);
    if (!product) {
      return res.status(404).json({ error: 'product not found' });
    }
    const priceHistory = await db.listPriceRevisions(req.params.code);
    res.json({ ...product, current_price: priceHistory[0]?.price ?? null, price_history: priceHistory });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { product_name, genre_id, temp_zone, container, volume_ml, price, effective_date } = req.body;
    if (!product_name || !genre_id) {
      return res.status(400).json({ error: 'product_name and genre_id are required' });
    }

    const products = await db.listProducts();
    if (products.some((p) => p.product_name === product_name)) {
      return res.status(409).json({ error: 'product_name already exists' });
    }

    const product_code = products.reduce((max, p) => Math.max(max, p.product_code), 0) + 1;
    await db.putProduct({
      product_code,
      product_name,
      genre_id: Number(genre_id),
      temp_zone: temp_zone ?? null,
      container: container ?? null,
      volume_ml: volume_ml ?? null,
    });

    if (price != null) {
      await db.putPriceRevision({
        revision_id: Date.now(),
        product_code,
        effective_date: effective_date ?? new Date().toISOString().slice(0, 10),
        price,
      });
    }

    res.status(201).json({ product_code });
  } catch (err) {
    next(err);
  }
});

router.put('/:code', async (req, res, next) => {
  try {
    const existing = await db.getProduct(req.params.code);
    if (!existing) {
      return res.status(404).json({ error: 'product not found' });
    }

    const { product_name, genre_id, temp_zone, container, volume_ml } = req.body;
    const updated = {
      ...existing,
      product_name: product_name ?? existing.product_name,
      genre_id: genre_id != null ? Number(genre_id) : existing.genre_id,
      temp_zone: temp_zone ?? existing.temp_zone,
      container: container ?? existing.container,
      volume_ml: volume_ml ?? existing.volume_ml,
    };
    await db.putProduct(updated);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/:code', async (req, res, next) => {
  try {
    const existing = await db.getProduct(req.params.code);
    if (!existing) {
      return res.status(404).json({ error: 'product not found' });
    }
    await db.deleteProduct(req.params.code);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
