const router = require('express').Router();
const db = require('../database/db');
const { verifyToken } = require('../middleware/auth');

router.patch('/', verifyToken, (req, res) => {
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(400).json({ error: 'latitude and longitude must be numbers' });
  }

  db.prepare('UPDATE users SET latitude = ?, longitude = ? WHERE id = ?')
    .run(latitude, longitude, req.user.userId);

  res.json({ message: 'Location updated' });
});

module.exports = router;
