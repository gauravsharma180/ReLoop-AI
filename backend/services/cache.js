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

module.exports = { hashImage, getCached };
