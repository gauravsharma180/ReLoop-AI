const router = require('express').Router();
const { query } = require('../database/db');
const { verifyToken } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.get('/', verifyToken, asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user.userId]
  );

  const unreadCount = rows.filter((n) => !n.is_read).length;

  res.json({ notifications: rows, unreadCount });
}));

router.patch('/read-all', verifyToken, asyncHandler(async (req, res) => {
  await query('UPDATE notifications SET is_read = true WHERE user_id = $1', [req.user.userId]);
  res.json({ message: 'All marked as read' });
}));

router.patch('/:id/read', verifyToken, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid notification id' });
  }

  const notification = (await query('SELECT * FROM notifications WHERE id = $1', [id])).rows[0];
  if (!notification) {
    return res.status(404).json({ error: 'Notification not found' });
  }
  if (notification.user_id !== req.user.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  await query('UPDATE notifications SET is_read = true WHERE id = $1', [id]);
  res.json({ message: 'Marked as read' });
}));

module.exports = router;
