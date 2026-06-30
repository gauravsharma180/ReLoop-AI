require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Importing this creates the SQLite tables (if missing) before any route
// can be hit, so the database is always ready at startup.
const db = require('./database/db');
const { verifyToken } = require('./middleware/auth');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/auth', require('./routes/auth'));
app.use('/grade', require('./routes/grade'));
app.use('/history', require('./routes/history'));
app.use('/exchange', require('./routes/exchange'));
app.use('/location', require('./routes/location'));
app.use('/interest', require('./routes/interest'));
app.use('/notifications', require('./routes/notifications'));
app.use('/predict-return', require('./routes/predictReturn'));

// Per-user impact, computed live from this user's own grades — not a
// platform-wide total, so each account sees only what it has rerouted.
app.get('/impact', verifyToken, (req, res) => {
  const row = db
    .prepare(`
      SELECT
        COUNT(*) AS itemsRerouted,
        COALESCE(SUM(estimated_value), 0) AS valueRecovered,
        COALESCE(SUM(co2_saved), 0) AS co2Avoided,
        COALESCE(SUM(green_credits), 0) AS creditsIssued
      FROM grades
      WHERE user_id = ? AND decision != 'NOT_A_PRODUCT'
    `)
    .get(req.user.userId);

  res.json(row);
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`SecondLife backend on :${PORT}`));
