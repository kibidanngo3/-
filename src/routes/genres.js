const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM genres ORDER BY genre_id').all();
  res.json(rows);
});

router.post('/', (req, res) => {
  const { genre_name } = req.body;
  if (!genre_name) {
    return res.status(400).json({ error: 'genre_name is required' });
  }
  try {
    const result = db.prepare('INSERT INTO genres (genre_name) VALUES (?)').run(genre_name);
    res.status(201).json({ genre_id: Number(result.lastInsertRowid), genre_name });
  } catch (err) {
    res.status(409).json({ error: 'genre_name already exists' });
  }
});

module.exports = router;
