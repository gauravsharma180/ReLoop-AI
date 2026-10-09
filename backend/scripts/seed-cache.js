// Pre-seed data/demoResponses.json with real graded results for your demo
// photos, so a dead or rate-limited AI API can never break a live run.
//
// Usage:
//   npm run seed-cache -- photo1.jpg photo2.png ...
//
// For each image: hashes the bytes, grades it with the real AI (Gemini if
// GEMINI_API_KEY is set, otherwise the deterministic mock), runs it through
// the rule engine + enrich, and saves the result keyed by md5 hash. Existing
// hashes are left untouched — safe to re-run as you add more photos.
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const ai = require('../services/ai');
const rules = require('../services/rules');
const { enrich } = require('../services/enrich');
const { hashImage } = require('../services/demoCache');

const DATA_FILE = path.join(__dirname, '..', 'data', 'demoResponses.json');
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('Usage: npm run seed-cache -- <image1> <image2> ...');
    process.exit(1);
  }

  const demoResponses = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

  for (const file of files) {
    const buffer = fs.readFileSync(file);
    const hash = hashImage(buffer);

    if (demoResponses[hash]) {
      console.log(`Skip ${file} — already cached (${hash}).`);
      continue;
    }

    const mime = MIME[path.extname(file).toLowerCase()] || 'image/jpeg';
    console.log(`Grading ${file} (${hash})...`);

    const graded = await ai.grade(buffer, mime);
    const ruled = rules.route(graded);
    const result = enrich(graded, ruled);

    console.log(`  -> ${result.item} | ${result.decision} | source=${result.source}`);
    demoResponses[hash] = result;
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(demoResponses, null, 2) + '\n');
  console.log(`\nSaved ${Object.keys(demoResponses).length} cached response(s) to ${path.relative(process.cwd(), DATA_FILE)}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
