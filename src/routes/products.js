const express = require('express');
const db = require('../postgres');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { genre_id } = req.query;
    const products = await db.listProducts(genre_id);
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

    const product_code = await db.createProduct({ product_name, genre_id, temp_zone, container, volume_ml });

    if (price != null) {
      await db.createPriceRevision({
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
    const { product_name, genre_id, temp_zone, container, volume_ml } = req.body;
    const updated = await db.updateProduct(req.params.code, { product_name, genre_id, temp_zone, container, volume_ml });
    if (!updated) {
      return res.status(404).json({ error: 'product not found' });
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/:code', async (req, res, next) => {
  try {
    const deleted = await db.deleteProduct(req.params.code);
    if (!deleted) {
      return res.status(404).json({ error: 'product not found' });
    }
    res.status(204).send();
  } catch (err) {
    if (err.isConflict) {
      return res.status(409).json({ error: '関連する仕入れ履歴・在庫記録・売値改定履歴があるため削除できません' });
    }
    next(err);
  }
});

module.exports = router;
