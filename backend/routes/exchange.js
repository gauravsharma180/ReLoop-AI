const router = require('express').Router();
const { query } = require('../database/db');
const { verifyToken } = require('../middleware/auth');
const { getDistanceKm } = require('../utils/distance');
const asyncHandler = require('../utils/asyncHandler');

const NEARBY_RADIUS_KM = 10;

const INSERT_LISTING_SQL = `
  INSERT INTO exchange_listings (
    grade_id, item_name, category, grade, original_decision,
    listed_by_user_id, latitude, longitude
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  RETURNING id
`;

const INTERESTED_USERS_SQL = `
  SELECT u.id AS user_id, u.latitude, u.longitude
  FROM interest_list il
  JOIN users u ON u.id = il.user_id
  WHERE il.category = $1 AND il.user_id != $2
`;

const INSERT_NOTIFICATION_SQL = `
  INSERT INTO notifications (user_id, type, listing_id, message)
  VALUES ($1, 'exchange_match', $2, $3)
`;

router.post('/list', verifyToken, asyncHandler(async (req, res) => {
  const gradeId = Number(req.body.gradeId);
  if (!Number.isInteger(gradeId)) {
    return res.status(400).json({ error: 'Invalid gradeId' });
  }

  const grade = (await query('SELECT * FROM grades WHERE id = $1', [gradeId])).rows[0];
  if (!grade) {
    return res.status(404).json({ error: 'Grade not found' });
  }
  if (grade.user_id !== req.user.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const existing = (await query('SELECT id FROM exchange_listings WHERE grade_id = $1', [gradeId])).rows[0];
  if (existing) {
    return res.status(400).json({ error: 'This item is already listed for exchange' });
  }

  const lister = (await query('SELECT latitude, longitude FROM users WHERE id = $1', [req.user.userId])).rows[0];
  const latitude = lister?.latitude ?? null;
  const longitude = lister?.longitude ?? null;

  const { rows } = await query(INSERT_LISTING_SQL, [
    grade.id,
    grade.item_name,
    grade.category,
    grade.grade,
    grade.decision,
    req.user.userId,
    latitude,
    longitude
  ]);
  const listingId = rows[0].id;

  // Notify nearby users who registered interest in this category — skip
  // entirely if the lister has no saved location to measure distance from.
  if (latitude != null && longitude != null) {
    const candidates = (await query(INTERESTED_USERS_SQL, [grade.category, req.user.userId])).rows;
    for (const u of candidates) {
      if (u.latitude == null || u.longitude == null) continue;
      const distance = getDistanceKm(latitude, longitude, u.latitude, u.longitude);
      if (distance <= NEARBY_RADIUS_KM) {
        await query(INSERT_NOTIFICATION_SQL, [
          u.user_id,
          listingId,
          `"${grade.item_name}" (Grade ${grade.grade}) is available for exchange near you — matches your interest in ${grade.category}`
        ]);
      }
    }
  }

  res.status(201).json({
    message: 'Listed for exchange',
    listingId,
    note: grade.decision !== 'EXCHANGE'
      ? `Note: AI recommended this item for ${grade.decision} — you chose to list it for P2P exchange instead`
      : null
  });
}));

router.get('/available', verifyToken, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM exchange_listings
     WHERE status = 'available' AND listed_by_user_id != $1
     ORDER BY listed_at DESC`,
    [req.user.userId]
  );

  res.json({ listings: rows });
}));

router.get('/my-listings', verifyToken, asyncHandler(async (req, res) => {
  const listedByMe = (await query(
    'SELECT * FROM exchange_listings WHERE listed_by_user_id = $1 ORDER BY listed_at DESC',
    [req.user.userId]
  )).rows;

  const claimedByMe = (await query(
    'SELECT * FROM exchange_listings WHERE claimed_by_user_id = $1 ORDER BY listed_at DESC',
    [req.user.userId]
  )).rows;

  res.json({ listedByMe, claimedByMe });
}));

router.post('/:id/claim', verifyToken, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid listing id' });
  }

  const listing = (await query('SELECT * FROM exchange_listings WHERE id = $1', [id])).rows[0];
  if (!listing) {
    return res.status(404).json({ error: 'Listing not found' });
  }
  if (listing.status !== 'available') {
    return res.status(400).json({ error: 'No longer available' });
  }
  if (listing.listed_by_user_id === req.user.userId) {
    return res.status(400).json({ error: 'Cannot claim your own listing' });
  }

  await query(
    `UPDATE exchange_listings
     SET status = 'claimed', claimed_by_user_id = $1, claimed_at = NOW()
     WHERE id = $2`,
    [req.user.userId, id]
  );

  res.json({ message: 'Item claimed successfully' });
}));

module.exports = router;
