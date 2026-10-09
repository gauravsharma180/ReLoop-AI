const router = require('express').Router();
const { query } = require('../database/db');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { getCached, setCached } = require('../services/cache');
const asyncHandler = require('../utils/asyncHandler');

const ANALYTICS_CACHE_TTL_SECONDS = 30;
const IMPACT_OVER_TIME_DAYS = 14;
const MOST_COMMON_FLAWS_LIMIT = 5;
const TOP_OPERATORS_LIMIT = 5;

// Only these decisions represent an actual routing outcome — NOT_A_PRODUCT
// and INSPECT are excluded, matching the routingBreakdown keys requested.
const ROUTING_LABELS = {
  RESELL: 'Resell',
  REFURBISH: 'Refurbish',
  DONATE: 'Donate',
  RECYCLE: 'Recycle',
  EXCHANGE: 'Exchange'
};

function pct(numerator, denominator) {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 10000) / 100;
}

// Zero-filled date buckets for the last N days (oldest first), so days with
// no grades still show up in the chart instead of being skipped.
function emptyDateBuckets(days) {
  const buckets = {};
  const order = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    buckets[date] = 0;
    order.push(date);
  }
  return { buckets, order };
}

router.get('/me', verifyToken, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const cacheKey = `analytics:me:${userId}`;

  const cached = await getCached(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const { rows } = await query(
    `SELECT grade, decision, fraud_flag, feedback, flaws,
            estimated_value, green_credits, co2_saved, created_at
     FROM grades WHERE user_id = $1`,
    [userId]
  );

  const totalGraded = rows.length;
  const gradeDistribution = { A: 0, B: 0, C: 0, D: 0 };
  const routingBreakdown = { Resell: 0, Refurbish: 0, Donate: 0, Recycle: 0, Exchange: 0 };
  const flawCounts = {};
  let fraudCount = 0;
  let feedbackTotal = 0;
  let feedbackCorrect = 0;
  let itemsRerouted = 0;
  let valueRecovered = 0;
  let co2Saved = 0;
  let greenCredits = 0;

  const { buckets: impactByDate, order: dateOrder } = emptyDateBuckets(IMPACT_OVER_TIME_DAYS);

  for (const r of rows) {
    if (r.grade in gradeDistribution) gradeDistribution[r.grade] += 1;

    const label = ROUTING_LABELS[r.decision];
    if (label) {
      routingBreakdown[label] += 1;
      itemsRerouted += 1;
      valueRecovered += r.estimated_value || 0;
      co2Saved += r.co2_saved || 0;
      greenCredits += r.green_credits || 0;
    }

    if (r.fraud_flag) fraudCount += 1;

    if (r.feedback !== null) {
      feedbackTotal += 1;
      if (r.feedback === 'correct') feedbackCorrect += 1;
    }

    // JSONB column — pg already hands this back as a real JS array, no
    // JSON.parse needed.
    if (r.flaws) {
      for (const flaw of r.flaws) {
        flawCounts[flaw] = (flawCounts[flaw] || 0) + 1;
      }
    }

    const date = r.created_at ? r.created_at.toISOString().slice(0, 10) : '';
    if (date in impactByDate) impactByDate[date] += 1;
  }

  const mostCommonFlaws = Object.entries(flawCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MOST_COMMON_FLAWS_LIMIT)
    .map(([flaw, count]) => ({ flaw, count }));

  const impactOverTime = dateOrder.map((date) => ({ date, count: impactByDate[date] }));

  const result = {
    totalGraded,
    gradeDistribution,
    routingBreakdown,
    fraudFlagRate: pct(fraudCount, totalGraded),
    accuracyRate: pct(feedbackCorrect, feedbackTotal),
    mostCommonFlaws,
    impactOverTime,
    totalImpact: {
      itemsRerouted,
      valueRecovered,
      co2Saved: Math.round(co2Saved * 100) / 100,
      greenCredits
    }
  };

  await setCached(cacheKey, result, ANALYTICS_CACHE_TTL_SECONDS);
  res.json(result);
}));

router.get('/admin', verifyToken, requireAdmin, asyncHandler(async (req, res) => {
  const cacheKey = 'analytics:admin';

  const cached = await getCached(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const users = (await query('SELECT id, email FROM users')).rows;
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  const { rows } = await query(
    `SELECT user_id, grade, decision, fraud_flag, feedback,
            estimated_value, green_credits, co2_saved
     FROM grades`
  );

  const totalGraded = rows.length;
  const gradeDistribution = { A: 0, B: 0, C: 0, D: 0 };
  const routingBreakdown = { Resell: 0, Refurbish: 0, Donate: 0, Recycle: 0, Exchange: 0 };
  const operatorStats = new Map();
  let fraudCount = 0;
  let feedbackTotal = 0;
  let feedbackCorrect = 0;
  let itemsRerouted = 0;
  let valueRecovered = 0;
  let co2Saved = 0;
  let greenCredits = 0;

  for (const r of rows) {
    if (r.grade in gradeDistribution) gradeDistribution[r.grade] += 1;

    const label = ROUTING_LABELS[r.decision];
    if (label) {
      routingBreakdown[label] += 1;
      itemsRerouted += 1;
      valueRecovered += r.estimated_value || 0;
      co2Saved += r.co2_saved || 0;
      greenCredits += r.green_credits || 0;
    }

    if (r.fraud_flag) fraudCount += 1;

    if (r.feedback !== null) {
      feedbackTotal += 1;
      if (r.feedback === 'correct') feedbackCorrect += 1;
    }

    if (!operatorStats.has(r.user_id)) {
      operatorStats.set(r.user_id, { itemsGraded: 0, feedbackTotal: 0, feedbackCorrect: 0 });
    }
    const op = operatorStats.get(r.user_id);
    op.itemsGraded += 1;
    if (r.feedback !== null) {
      op.feedbackTotal += 1;
      if (r.feedback === 'correct') op.feedbackCorrect += 1;
    }
  }

  const topOperators = [...operatorStats.entries()]
    .sort((a, b) => b[1].itemsGraded - a[1].itemsGraded)
    .slice(0, TOP_OPERATORS_LIMIT)
    .map(([userId, op]) => ({
      email: emailById.get(userId) || 'unknown',
      itemsGraded: op.itemsGraded,
      accuracy: pct(op.feedbackCorrect, op.feedbackTotal)
    }));

  const result = {
    totalUsers: users.length,
    totalGraded,
    gradeDistribution,
    routingBreakdown,
    fraudFlagRate: pct(fraudCount, totalGraded),
    platformAccuracy: pct(feedbackCorrect, feedbackTotal),
    topOperators,
    totalImpact: {
      itemsRerouted,
      valueRecovered,
      co2Saved: Math.round(co2Saved * 100) / 100,
      greenCredits
    }
  };

  await setCached(cacheKey, result, ANALYTICS_CACHE_TTL_SECONDS);
  res.json(result);
}));

module.exports = router;
