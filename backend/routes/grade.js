// POST /grade  — the request lifecycle.
// validate -> cache lookup (demo safety) -> AI grade -> rule engine -> enrich -> persist
const router = require('express').Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const ai = require('../services/ai');
const rules = require('../services/rules');
const { enrich } = require('../services/enrich');
const demoCache = require('../services/demoCache');
const { getCached, setCached } = require('../services/cache');
const { query } = require('../database/db');
const { verifyToken } = require('../middleware/auth');

const GRADE_CACHE_TTL_SECONDS = 24 * 60 * 60;
const REVIEW_CONFIDENCE_THRESHOLD = 60;

const INSERT_GRADE_SQL = `
  INSERT INTO grades (
    user_id, item_name, category, grade, confidence, decision, flaws,
    fraud_flag, low_confidence_flag, estimated_value, green_credits,
    co2_saved, image_hash, source, review_status
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
  ) RETURNING id
`;

router.post('/', verifyToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Add a product photo to grade it.' });
    }
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'That file is not an image. Upload a JPG or PNG.' });
    }

    // Demo-safety: known demo image -> saved response, with a small delay so
    // it still feels like real analysis.
    const demoResult = demoCache.getCached(req.file.buffer);
    if (demoResult) {
      await new Promise((r) => setTimeout(r, 1200));
      return res.json({ ...demoResult, cached: true });
    }

    const imageHash = demoCache.hashImage(req.file.buffer);
    const gradeCacheKey = `grade:${imageHash}`;

    let result = await getCached(gradeCacheKey);
    const cacheHit = result !== null;

    if (!cacheHit) {
      const graded = await ai.grade(req.file.buffer, req.file.mimetype);
      const ruled = rules.route(graded);
      result = enrich(graded, ruled);
      await setCached(gradeCacheKey, result, GRADE_CACHE_TTL_SECONDS);
    }

    // Below-threshold confidence means the rule engine's routing decision
    // isn't trustworthy enough to auto-apply — hold it for manual review
    // instead of silently routing it. NOT_A_PRODUCT is exempt: there's no
    // routing decision to review, just a re-upload prompt.
    const needsReview = result.decision !== 'NOT_A_PRODUCT'
      && result.confidence < REVIEW_CONFIDENCE_THRESHOLD;
    if (needsReview) {
      result = {
        ...result,
        decision: 'NEEDS_REVIEW',
        decisionReason: `Confidence below ${REVIEW_CONFIDENCE_THRESHOLD}% — flagged for manual review instead of auto-routing.`
      };
    }

    const { rows } = await query(INSERT_GRADE_SQL, [
      req.user.userId,
      result.item,
      result.category,
      result.conditionGrade,
      result.confidence,
      result.decision,
      // JSONB column: node-postgres serializes a bare JS array as a Postgres
      // ARRAY literal, not JSON text — it only auto-JSON.stringifies plain
      // objects. Stringifying explicitly is what actually produces valid
      // JSON for the column; reading it back needs no JSON.parse, since pg
      // parses json/jsonb columns back into JS values automatically.
      JSON.stringify(result.detectedFlaws),
      result.usedAsNewRisk,
      result.confidence < REVIEW_CONFIDENCE_THRESHOLD,
      result.resalePriceInr,
      result.greenCredits,
      result.co2SavedKg,
      imageHash,
      result.source,
      needsReview ? 'needs_review' : 'auto_routed'
    ]);

    res.json({ ...result, gradeId: rows[0].id, cached: cacheHit });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not grade this item. Try another photo.' });
  }
});

module.exports = router;
