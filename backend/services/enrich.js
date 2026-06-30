// ENRICH — turns grade + rule decision into the money + impact numbers and
// pulls refurbished recommendations. All from the catalog, all explainable.
const catalog = require('../data/catalog.json');
const products = require('../data/products.json');

// Mock warranty lookup — no real returns/warranty system yet, so every item
// gets a category-appropriate placeholder for the Product Health Card.
const WARRANTY_BY_CATEGORY = {
  electronics: 'Warranty: 12 months remaining',
  home: 'Warranty: 12 months remaining',
  footwear: 'No manufacturer warranty applicable',
  apparel: 'No manufacturer warranty applicable',
  default: 'No manufacturer warranty applicable'
};

// Best-effort match of the AI's guess against the product catalog: same
// category, preferring a name that shares a real word with the AI's "item"
// (e.g. "Bluetooth Speaker" -> "JBL Flip 5 Bluetooth Speaker"). Falls back to
// the first product in that category, or null if the category has none.
function findProduct(ai) {
  const candidates = Object.values(products).filter((p) => p.category === ai.category);
  if (candidates.length === 0) return null;

  const itemWords = (ai.item || '').toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const keywordMatch = candidates.find((p) => {
    const nameWords = p.name.toLowerCase().split(/\s+/);
    return itemWords.some((w) => nameWords.includes(w));
  });

  return keywordMatch || candidates[0];
}

function enrich(ai, ruled) {
  if (ruled.decision === 'NOT_A_PRODUCT') {
    return {
      item: ai.item,
      category: ai.category,
      conditionGrade: null,
      confidence: ai.confidence,
      detectedFlaws: ai.detected_flaws || [],
      usedAsNewRisk: !!ai.used_as_new_risk,
      reasoning: ai.visible_reasoning,
      decision: ruled.decision,
      decisionReason: ruled.reason,
      originalPriceInr: 0,
      resalePriceInr: 0,
      greenCredits: 0,
      co2SavedKg: 0,
      recommendations: [],
      source: ai._source
    };
  }

  // A matched catalog product overrides the AI-guessed category and price
  // with the real listing's data; otherwise fall back to the category catalog.
  const product = findProduct(ai);
  const category = product ? product.category : ai.category;
  const cat = catalog.categories[category] || catalog.categories.default;
  const round = (n) => Math.round(n / 10) * 10;

  const basePriceInr = product ? product.originalPriceInr : cat.basePriceInr;
  const resalePriceInr = round(basePriceInr * ruled.priceFactor);
  const greenCredits = Math.round(cat.baseCredits * ruled.creditsMult);
  // Recycling recovers materials but saves less embodied carbon than reuse.
  const co2SavedKg = +(cat.co2KgIfSaved * (ruled.decision === 'RECYCLE' ? 0.5 : 1)).toFixed(1);

  // Exchange listings aren't refurb inventory — skip the "you might like" rail.
  const recommendations = ruled.decision === 'EXCHANGE' ? [] : catalog.refurbished
    .filter((p) => p.category === category)
    .slice(0, 3)
    .map((p) => ({ name: p.name, priceInr: p.priceInr }));

  return {
    item: ai.item,
    category,
    conditionGrade: ai.condition_grade,
    confidence: ai.confidence,
    detectedFlaws: ai.detected_flaws || [],
    usedAsNewRisk: !!ai.used_as_new_risk,
    reasoning: ai.visible_reasoning,
    decision: ruled.decision,
    decisionReason: ruled.reason,
    originalPriceInr: basePriceInr,
    resalePriceInr,
    greenCredits,
    co2SavedKg,
    recommendations,
    history: 'First return — no prior history',
    warrantyStatus: WARRANTY_BY_CATEGORY[category] || WARRANTY_BY_CATEGORY.default,
    source: ai._source,
    ...(product ? { name: product.name, brand: product.brand } : {})
  };
}

module.exports = { enrich };
