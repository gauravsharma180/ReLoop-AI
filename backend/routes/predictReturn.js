// POST /predict-return — the differentiator: stop the bad return BEFORE it happens.
// At checkout, score how likely THIS purchase is to come back, and suggest a nudge.
// Deterministic rules over order signals — explainable, no model needed for the demo.
const router = require('express').Router();

// expects JSON: { category, price_inr, size_selected, size_available, returned_before, review_avg }
router.post('/', (req, res) => {
  const b = req.body || {};
  let risk = 0;
  const factors = [];

  // High-return categories (apparel/footwear notoriously high)
  if (['apparel', 'footwear'].includes(b.category)) { risk += 30; factors.push('High-return category'); }
  // No size guidance chosen for a sized item
  if ((b.category === 'apparel' || b.category === 'footwear') && !b.size_selected) { risk += 20; factors.push('No size selected'); }
  // Customer has a history of returns
  if (Number(b.returned_before) >= 2) { risk += 25; factors.push('Frequent returner'); }
  // Weak product reviews correlate with disappointment returns
  if (Number(b.review_avg) && b.review_avg < 3.5) { risk += 15; factors.push('Low review score'); }
  // Big-ticket buys get returned more on second thoughts
  if (Number(b.price_inr) > 4000) { risk += 10; factors.push('High price point'); }

  risk = Math.min(risk, 95);
  const band = risk >= 60 ? 'HIGH' : risk >= 30 ? 'MEDIUM' : 'LOW';

  const nudge = band === 'HIGH'
    ? 'Show size guide + verified-fit reviews before checkout; offer exchange-first instead of return.'
    : band === 'MEDIUM'
      ? 'Surface a fit/spec reminder so the customer buys with confidence.'
      : 'No action needed — low return risk.';

  res.json({ risk_score: risk, risk_band: band, factors, recommended_nudge: nudge });
});

module.exports = router;
