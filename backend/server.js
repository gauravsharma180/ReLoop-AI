require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { query, initDb } = require('./database/db');
const { verifyToken } = require('./middleware/auth');
const { getCached, setCached } = require('./services/cache');
const asyncHandler = require('./utils/asyncHandler');

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
app.use('/analytics', require('./routes/analytics'));
app.use('/review', require('./routes/review'));

const IMPACT_FOR_USER_SQL = `
  SELECT
    COUNT(*) AS "itemsRerouted",
    COALESCE(SUM(estimated_value), 0) AS "valueRecovered",
    COALESCE(SUM(co2_saved), 0) AS "co2Avoided",
    COALESCE(SUM(green_credits), 0) AS "creditsIssued"
  FROM grades
  WHERE user_id = $1 AND decision NOT IN ('NOT_A_PRODUCT', 'NEEDS_REVIEW')
`;

const IMPACT_PLATFORM_WIDE_SQL = `
  SELECT
    COUNT(*) AS "itemsRerouted",
    COALESCE(SUM(estimated_value), 0) AS "valueRecovered",
    COALESCE(SUM(co2_saved), 0) AS "co2Avoided",
    COALESCE(SUM(green_credits), 0) AS "creditsIssued"
  FROM grades
  WHERE decision NOT IN ('NOT_A_PRODUCT', 'NEEDS_REVIEW')
`;

// Impact, computed live from the grades table — the single source of truth,
// no separate counter to keep in sync. Defaults to the caller's own totals
// (?userId omitted); pass ?userId=<id> for another user's, or ?userId=all
// for platform-wide. Cached for 10s: impact changes on every grade, so the
// TTL stays short just to absorb bursts of reads under load without serving
// stale data.
app.get('/impact', verifyToken, asyncHandler(async (req, res) => {
  const platformWide = req.query.userId === 'all';
  const targetUserId = platformWide ? null : (req.query.userId || req.user.userId);
  const cacheKey = platformWide ? 'impact:totals:platform' : `impact:totals:${targetUserId}`;

  const cached = await getCached(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const row = platformWide
    ? (await query(IMPACT_PLATFORM_WIDE_SQL)).rows[0]
    : (await query(IMPACT_FOR_USER_SQL, [targetUserId])).rows[0];

  await setCached(cacheKey, row, 10);
  res.json(row);
}));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

initDb()
  .then(() => {
    console.log('Database initialized');
    app.listen(PORT, () => console.log(`SecondLife backend on :${PORT}`));
  })
  .catch((e) => {
    console.error('Failed to initialize database:', e);
    process.exit(1);
  });
