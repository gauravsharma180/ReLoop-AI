const router = require('express').Router();
const { query } = require('../database/db');
const { verifyToken } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

function pct(numerator, denominator) {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 10000) / 100;
}

// NOTE: registered before GET /:id so "stats" isn't swallowed as an :id param.
router.get('/stats', verifyToken, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT grade, decision, fraud_flag, low_confidence_flag, feedback,
            green_credits, co2_saved, estimated_value
     FROM grades WHERE user_id = $1`,
    [req.user.userId]
  );

  const totalGraded = rows.length;
  const gradeDistribution = { A: 0, B: 0, C: 0, D: 0 };
  const routingBreakdown = {};
  let fraudCount = 0;
  let lowConfidenceCount = 0;
  let feedbackTotal = 0;
  let feedbackCorrect = 0;
  let totalGreenCredits = 0;
  let totalCo2Saved = 0;
  let totalValueRecovered = 0;

  for (const r of rows) {
    if (r.grade in gradeDistribution) gradeDistribution[r.grade] += 1;
    if (r.decision) routingBreakdown[r.decision] = (routingBreakdown[r.decision] || 0) + 1;
    if (r.fraud_flag) fraudCount += 1;
    if (r.low_confidence_flag) lowConfidenceCount += 1;
    if (r.feedback !== null) {
      feedbackTotal += 1;
      if (r.feedback === 'correct') feedbackCorrect += 1;
    }
    totalGreenCredits += r.green_credits || 0;
    totalCo2Saved += r.co2_saved || 0;
    totalValueRecovered += r.estimated_value || 0;
  }

  res.json({
    totalGraded,
    gradeDistribution,
    routingBreakdown,
    fraudFlagRate: pct(fraudCount, totalGraded),
    lowConfidenceRate: pct(lowConfidenceCount, totalGraded),
    accuracyRate: pct(feedbackCorrect, feedbackTotal),
    totalGreenCredits,
    totalCo2Saved: Math.round(totalCo2Saved * 100) / 100,
    totalValueRecovered
  });
}));

router.get('/:id', verifyToken, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid grade id' });
  }

  const grade = (await query('SELECT * FROM grades WHERE id = $1', [id])).rows[0];
  if (!grade) {
    return res.status(404).json({ error: 'Grade not found' });
  }
  if (grade.user_id !== req.user.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.json({ grade });
}));

router.patch('/:id/feedback', verifyToken, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid grade id' });
  }

  const { feedback } = req.body;
  if (feedback !== 'correct' && feedback !== 'incorrect') {
    return res.status(400).json({ error: "Feedback must be 'correct' or 'incorrect'" });
  }

  const grade = (await query('SELECT id, user_id, feedback FROM grades WHERE id = $1', [id])).rows[0];
  if (!grade) {
    return res.status(404).json({ error: 'Grade not found' });
  }
  if (grade.user_id !== req.user.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (grade.feedback !== null) {
    return res.status(400).json({ error: 'Feedback already submitted' });
  }

  await query('UPDATE grades SET feedback = $1 WHERE id = $2', [feedback, id]);

  res.json({ message: 'Feedback saved', gradeId: id, feedback });
}));

router.get('/', verifyToken, asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM grades WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user.userId]
  );

  res.json({ grades: rows });
}));

module.exports = router;
