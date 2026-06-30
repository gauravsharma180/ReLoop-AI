const router = require('express').Router();
const db = require('../database/db');
const { verifyToken } = require('../middleware/auth');

router.get('/', verifyToken, (req, res) => {
  const notifications = db
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.user.userId);

  const unreadCount = notifications.filter((n) => n.is_read === 0).length;

  res.json({ notifications, unreadCount });
});

router.patch('/read-all', verifyToken, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.userId);
  res.json({ message: 'All marked as read' });
});

router.patch('/:id/read', verifyToken, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid notification id' });
  }

  const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
  if (!notification) {
    return res.status(404).json({ error: 'Notification not found' });
  }
  if (notification.user_id !== req.user.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
  res.json({ message: 'Marked as read' });
});

module.exports = router;
