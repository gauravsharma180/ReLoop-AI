// POST /grade  — the request lifecycle.
// validate -> cache lookup (demo safety) -> AI grade -> rule engine -> enrich
const router = require('express').Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const ai = require('../services/ai');
const rules = require('../services/rules');
const { enrich } = require('../services/enrich');
const cache = require('../services/cache');

router.post('/', upload.single('image'), async (req, res) => {
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
      if (cached.decision !== 'NOT_A_PRODUCT') cache.addImpact(cached);
      return res.json({ ...cached, cached: true });
    }

    const graded = await ai.grade(req.file.buffer, req.file.mimetype);
    const ruled = rules.route(graded);
    const result = enrich(graded, ruled);

    if (result.decision !== 'NOT_A_PRODUCT') cache.addImpact(result);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not grade this item. Try another photo.' });
  }
});

module.exports = router;
