const router = require('express').Router();
const { query } = require('../database/db');
const { verifyToken } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

// Matches the decision values the rule engine (services/rules.js) actually
// produces — keeps a manually-resolved item consistent with everything else
// downstream that keys off `decision` (Product Health Card, analytics).
const VALID_DECISIONS = ['RESELL', 'REFURBISH', 'DONATE', 'RECYCLE', 'EXCHANGE'];

router.get('/queue', verifyToken, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM grades
     WHERE user_id = $1 AND review_status = 'needs_review'
     ORDER BY created_at DESC`,
    [req.user.userId]
  );

  res.json({ queue: rows });
}));

router.patch('/:id/resolve', verifyToken, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid grade id' });
  }

  const { decision } = req.body;
  if (!VALID_DECISIONS.includes(decision)) {
    return res.status(400).json({ error: `Decision must be one of: ${VALID_DECISIONS.join(', ')}` });
  }

  const grade = (await query('SELECT id, user_id, review_status FROM grades WHERE id = $1', [id])).rows[0];
  if (!grade) {
    return res.status(404).json({ error: 'Grade not found' });
  }
  if (grade.user_id !== req.user.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (grade.review_status !== 'needs_review') {
    return res.status(400).json({ error: 'This item is not awaiting review' });
  }

  await query(
    `UPDATE grades
     SET decision = $1, review_status = 'manually_resolved', resolved_at = NOW()
     WHERE id = $2`,
    [decision, id]
  );

  res.json({ message: 'Review resolved', gradeId: id, decision });
}));

module.exports = router;
