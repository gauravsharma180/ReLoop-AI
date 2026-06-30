// POST /grade  — the request lifecycle.
// validate -> cache lookup (demo safety) -> AI grade -> rule engine -> enrich -> persist
const router = require('express').Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const ai = require('../services/ai');
const rules = require('../services/rules');
const { enrich } = require('../services/enrich');
const cache = require('../services/cache');
const db = require('../database/db');
const { verifyToken } = require('../middleware/auth');

const insertGrade = db.prepare(`
  INSERT INTO grades (
    user_id, item_name, category, grade, confidence, decision, flaws,
    fraud_flag, low_confidence_flag, estimated_value, green_credits,
    co2_saved, image_hash, source
  ) VALUES (
    @user_id, @item_name, @category, @grade, @confidence, @decision, @flaws,
    @fraud_flag, @low_confidence_flag, @estimated_value, @green_credits,
    @co2_saved, @image_hash, @source
  )
`);

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
    const cached = cache.getCached(req.file.buffer);
    if (cached) {
      await new Promise((r) => setTimeout(r, 1200));
      return res.json({ ...cached, cached: true });
    }

    const graded = await ai.grade(req.file.buffer, req.file.mimetype);
    const ruled = rules.route(graded);
    const result = enrich(graded, ruled);

    const { lastInsertRowid: gradeId } = insertGrade.run({
      user_id: req.user.userId,
      item_name: result.item,
      category: result.category,
      grade: result.conditionGrade,
      confidence: result.confidence,
      decision: result.decision,
      flaws: JSON.stringify(result.detectedFlaws),
      fraud_flag: result.usedAsNewRisk ? 1 : 0,
      low_confidence_flag: result.confidence < 60 ? 1 : 0,
      estimated_value: result.resalePriceInr,
      green_credits: result.greenCredits,
      co2_saved: result.co2SavedKg,
      image_hash: cache.hashImage(req.file.buffer),
      source: result.source
    });

    if (result.decision !== 'NOT_A_PRODUCT') {
      bumpImpact.run({
        value: result.resalePriceInr,
        co2: result.co2SavedKg,
        credits: result.greenCredits
      });
    }

    res.json({ ...result, gradeId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not grade this item. Try another photo.' });
  }
});

module.exports = router;
