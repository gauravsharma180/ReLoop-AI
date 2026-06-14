// Demo-safety layer.
// Hash the uploaded image bytes -> if it matches a pre-seeded demo image,
// return the saved response instantly. A dead/absent AI API can never break
// the live demo. Pre-seed ../data/demoResponses.json with your own demo image
// hashes the night before judging — run `npm run seed-cache <image files...>`.
const crypto = require('crypto');

const demoResponses = require('../data/demoResponses.json');

function hashImage(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

function getCached(buffer) {
  return demoResponses[hashImage(buffer)] || null;
}

// Tiny in-memory tally so the ImpactCounter feels alive across uploads.
const impact = { items: 0, inrSaved: 0, co2SavedKg: 0, greenCredits: 0 };
function addImpact(r) {
  impact.items += 1;
  impact.inrSaved += r.resalePriceInr || 0;
  impact.co2SavedKg += r.co2SavedKg || 0;
  impact.greenCredits += r.greenCredits || 0;
}
function getImpact() { return impact; }

module.exports = { hashImage, getCached, addImpact, getImpact };
