const router = require('express').Router();
const db = require('../database/db');
const { verifyToken } = require('../middleware/auth');
const { getDistanceKm } = require('../utils/distance');

const NEARBY_RADIUS_KM = 10;

const insertListing = db.prepare(`
  INSERT INTO exchange_listings (
    grade_id, item_name, category, grade, original_decision,
    listed_by_user_id, latitude, longitude
  ) VALUES (
    @grade_id, @item_name, @category, @grade, @original_decision,
    @listed_by_user_id, @latitude, @longitude
  )
`);

const interestedUsersInCategory = db.prepare(`
  SELECT u.id AS user_id, u.latitude, u.longitude
  FROM interest_list il
  JOIN users u ON u.id = il.user_id
  WHERE il.category = ? AND il.user_id != ?
`);

const insertNotification = db.prepare(`
  INSERT INTO notifications (user_id, type, listing_id, message)
  VALUES (?, 'exchange_match', ?, ?)
`);

router.post('/list', verifyToken, (req, res) => {
  const gradeId = Number(req.body.gradeId);
  if (!Number.isInteger(gradeId)) {
    return res.status(400).json({ error: 'Invalid gradeId' });
  }

  const grade = db.prepare('SELECT * FROM grades WHERE id = ?').get(gradeId);
  if (!grade) {
    return res.status(404).json({ error: 'Grade not found' });
  }
  if (grade.user_id !== req.user.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const existing = db.prepare('SELECT id FROM exchange_listings WHERE grade_id = ?').get(gradeId);
  if (existing) {
    return res.status(400).json({ error: 'This item is already listed for exchange' });
  }

  const lister = db.prepare('SELECT latitude, longitude FROM users WHERE id = ?').get(req.user.userId);
  const latitude = lister?.latitude ?? null;
  const longitude = lister?.longitude ?? null;

  const { lastInsertRowid: listingId } = insertListing.run({
    grade_id: grade.id,
    item_name: grade.item_name,
    category: grade.category,
    grade: grade.grade,
    original_decision: grade.decision,
    listed_by_user_id: req.user.userId,
    latitude,
    longitude
  });

  // Notify nearby users who registered interest in this category — skip
  // entirely if the lister has no saved location to measure distance from.
  if (latitude != null && longitude != null) {
    const candidates = interestedUsersInCategory.all(grade.category, req.user.userId);
    for (const u of candidates) {
      if (u.latitude == null || u.longitude == null) continue;
      const distance = getDistanceKm(latitude, longitude, u.latitude, u.longitude);
      if (distance <= NEARBY_RADIUS_KM) {
        insertNotification.run(
          u.user_id,
          listingId,
          `"${grade.item_name}" (Grade ${grade.grade}) is available for exchange near you — matches your interest in ${grade.category}`
        );
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
});

router.get('/available', verifyToken, (req, res) => {
  const listings = db
    .prepare(`
      SELECT * FROM exchange_listings
      WHERE status = 'available' AND listed_by_user_id != ?
      ORDER BY listed_at DESC
    `)
    .all(req.user.userId);

  res.json({ listings });
});

router.get('/my-listings', verifyToken, (req, res) => {
  const listedByMe = db
    .prepare('SELECT * FROM exchange_listings WHERE listed_by_user_id = ? ORDER BY listed_at DESC')
    .all(req.user.userId);

  const claimedByMe = db
    .prepare('SELECT * FROM exchange_listings WHERE claimed_by_user_id = ? ORDER BY listed_at DESC')
    .all(req.user.userId);

  res.json({ listedByMe, claimedByMe });
});

router.post('/:id/claim', verifyToken, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid listing id' });
  }

  const listing = db.prepare('SELECT * FROM exchange_listings WHERE id = ?').get(id);
  if (!listing) {
    return res.status(404).json({ error: 'Listing not found' });
  }
  if (listing.status !== 'available') {
    return res.status(400).json({ error: 'No longer available' });
  }
  if (listing.listed_by_user_id === req.user.userId) {
    return res.status(400).json({ error: 'Cannot claim your own listing' });
  }

  db.prepare(`
    UPDATE exchange_listings
    SET status = 'claimed', claimed_by_user_id = ?, claimed_at = datetime('now')
    WHERE id = ?
  `).run(req.user.userId, id);

  res.json({ message: 'Item claimed successfully' });
});

module.exports = router;
