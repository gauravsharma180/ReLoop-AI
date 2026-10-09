const router = require('express').Router();
const { query } = require('../database/db');
const { verifyToken } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.patch('/', verifyToken, asyncHandler(async (req, res) => {
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(400).json({ error: 'latitude and longitude must be numbers' });
  }

  await query(
    'UPDATE users SET latitude = $1, longitude = $2 WHERE id = $3',
    [latitude, longitude, req.user.userId]
  );

  res.json({ message: 'Location updated' });
}));

module.exports = router;
