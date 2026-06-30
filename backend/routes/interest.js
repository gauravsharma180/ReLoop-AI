const router = require('express').Router();
const db = require('../database/db');
const { verifyToken } = require('../middleware/auth');

const insertInterest = db.prepare(`
  INSERT INTO interest_list (user_id, category) VALUES (?, ?)
`);

router.post('/', verifyToken, (req, res) => {
  const { category } = req.body;
  if (!category || typeof category !== 'string') {
    return res.status(400).json({ error: 'category is required' });
  }

  try {
    insertInterest.run(req.user.userId, category);
    res.status(201).json({ message: 'Interest registered' });
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE' || /UNIQUE constraint failed/i.test(e.message)) {
      return res.status(200).json({ message: 'Already interested in this category' });
    }
    throw e;
  }
});

router.delete('/:category', verifyToken, (req, res) => {
  db.prepare('DELETE FROM interest_list WHERE user_id = ? AND category = ?')
    .run(req.user.userId, req.params.category);

  res.json({ message: 'Interest removed' });
});

router.get('/', verifyToken, (req, res) => {
  const rows = db
    .prepare('SELECT category FROM interest_list WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.user.userId);

  res.json({ interests: rows.map((r) => r.category) });
});

module.exports = router;
