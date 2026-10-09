const router = require('express').Router();
const { query } = require('../database/db');
const { verifyToken } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const UNIQUE_VIOLATION = '23505';

router.post('/', verifyToken, asyncHandler(async (req, res) => {
  const { category } = req.body;
  if (!category || typeof category !== 'string') {
    return res.status(400).json({ error: 'category is required' });
  }

  try {
    await query('INSERT INTO interest_list (user_id, category) VALUES ($1, $2)', [req.user.userId, category]);
    res.status(201).json({ message: 'Interest registered' });
  } catch (e) {
    if (e.code === UNIQUE_VIOLATION) {
      return res.status(200).json({ message: 'Already interested in this category' });
    }
    throw e;
  }
}));

router.delete('/:category', verifyToken, asyncHandler(async (req, res) => {
  await query(
    'DELETE FROM interest_list WHERE user_id = $1 AND category = $2',
    [req.user.userId, req.params.category]
  );

  res.json({ message: 'Interest removed' });
}));

router.get('/', verifyToken, asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT category FROM interest_list WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user.userId]
  );

  res.json({ interests: rows.map((r) => r.category) });
}));

module.exports = router;
