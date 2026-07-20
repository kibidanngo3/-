const path = require('node:path');
const express = require('express');
const cors = require('cors');

const genresRouter = require('./routes/genres');
const productsRouter = require('./routes/products');
const purchasesRouter = require('./routes/purchases');
const salesRouter = require('./routes/sales');
const stockRecordsRouter = require('./routes/stockRecords');
const priceRevisionsRouter = require('./routes/priceRevisions');
const recommendationsRouter = require('./routes/recommendations');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/genres', genresRouter);
app.use('/api/products', productsRouter);
app.use('/api/purchases', purchasesRouter);
app.use('/api/sales', salesRouter);
app.use('/api/stock-records', stockRecordsRouter);
app.use('/api/price-revisions', priceRevisionsRouter);
app.use('/api/recommendations', recommendationsRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

module.exports = app;
