const express = require('express');
const db = require('../postgres');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await db.listGenres());
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { genre_name } = req.body;
    if (!genre_name) {
      return res.status(400).json({ error: 'genre_name is required' });
    }

    const genres = await db.listGenres();
    if (genres.some((g) => g.genre_name === genre_name)) {
      return res.status(409).json({ error: 'genre_name already exists' });
    }

    const genre = await db.createGenre(genre_name);
    res.status(201).json(genre);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
