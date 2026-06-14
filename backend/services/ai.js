// AI LAYER — the brain. Its ONLY job is to judge physical condition from the
// photo. It does NOT decide routing, price, or credits (that's rules.js +
// enrich.js, in plain code, so every number is explainable to a judge).
//
// Primary:  Amazon Bedrock, Nova Lite (set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in .env).
// Fallback: Google Gemini vision (set GEMINI_API_KEY in .env).
// Fallback: deterministic mock derived from the image hash, so the app runs
//           on localhost with no keys and different images give different,
//           stable results — perfect for a demo.
const crypto = require('crypto');

const GRADE_FIXTURES = [
  { item: 'Wireless Headphones', category: 'electronics', condition_grade: 'A', confidence: 91,
    detected_flaws: [], used_as_new_risk: false,
    visible_reasoning: 'Pristine body, no visible wear, packaging intact.' },
  { item: 'Bluetooth Speaker', category: 'electronics', condition_grade: 'B', confidence: 78,
    detected_flaws: ['scuff on top grille', 'minor cable wear'], used_as_new_risk: true,
    visible_reasoning: 'Light cosmetic wear, fully functional, shows signs of prior use.' },
  { item: 'Running Shoes', category: 'footwear', condition_grade: 'B', confidence: 82,
    detected_flaws: ['sole creasing', 'light dirt on toe'], used_as_new_risk: true,
    visible_reasoning: 'Worn but structurally sound; cleanable and resaleable as renewed.' },
  { item: 'Cotton Hoodie', category: 'apparel', condition_grade: 'C', confidence: 69,
    detected_flaws: ['faded color', 'pilling on sleeves'], used_as_new_risk: true,
    visible_reasoning: 'Usable but below resale grade; suitable for donation.' },
  { item: 'Ceramic Mug Set', category: 'home', condition_grade: 'D', confidence: 88,
    detected_flaws: ['cracked handle', 'chipped rim'], used_as_new_risk: false,
    visible_reasoning: 'Structural damage present; only material recovery is viable.' },
  { item: 'Not a product', category: 'not_a_product', condition_grade: 'D', confidence: 0,
    detected_flaws: [], used_as_new_risk: false,
    visible_reasoning: 'Image shows a person, not a sellable retail item.' }
];

function mockGrade(buffer) {
  const h = crypto.createHash('md5').update(buffer).digest('hex');
  const idx = parseInt(h.slice(0, 8), 16) % GRADE_FIXTURES.length;
  return { ...GRADE_FIXTURES[idx], _source: 'mock' };
}

const PROMPT = `You are Amazon's returns triage engine. Judge ONLY the physical
condition of the item in the image. Output ONLY valid JSON, no markdown:
{
  "item": "short name",
  "category": "electronics|footwear|apparel|home|default",
  "condition_grade": "A|B|C|D",
  "confidence": <number 0-100>,
  "detected_flaws": ["..."],
  "used_as_new_risk": true|false,
  "visible_reasoning": "one sentence on what you see"
}
Grade A = like new, B = light wear/functional, C = usable not resale-grade,
D = damaged/non-functional. used_as_new_risk = item looks used despite a
"new" return claim.

"confidence" MUST be a JSON number between 0 and 100 (e.g. 87), never a
string and never a word like "high", "medium", or "low".

Guardrail: if the image does NOT show a sellable retail product — e.g. a
person, a body part, an animal, a screenshot, a drawing, or anything else
that isn't a physical item that could be resold, refurbished, donated, or
recycled — output ONLY this instead:
{
  "item": "Not a product",
  "category": "not_a_product",
  "condition_grade": "D",
  "confidence": 0,
  "detected_flaws": [],
  "used_as_new_risk": false,
  "visible_reasoning": "one sentence on what the image actually shows"
}`;

// Stamp the source and make sure confidence is always a number, even if a
// model returns it as a string (or a word like "high") despite the prompt.
function normalize(parsed, source) {
  parsed._source = source;
  parsed.confidence = Number(parsed.confidence);
  if (Number.isNaN(parsed.confidence)) parsed.confidence = 0;
  return parsed;
}

// Bedrock's Converse API only accepts these image formats.
const BEDROCK_IMAGE_FORMATS = ['png', 'jpeg', 'gif', 'webp'];

async function gradeWithBedrock(buffer, mime) {
  const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');
  const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'ap-southeast-2' });

  let format = (mime || 'image/jpeg').split('/')[1] || 'jpeg';
  if (format === 'jpg') format = 'jpeg';
  if (!BEDROCK_IMAGE_FORMATS.includes(format)) format = 'jpeg';

  const resp = await client.send(new ConverseCommand({
    modelId: 'amazon.nova-lite-v1:0',
    messages: [{
      role: 'user',
      content: [
        { image: { format, source: { bytes: buffer } } },
        { text: PROMPT }
      ]
    }],
    inferenceConfig: { maxTokens: 1024, temperature: 0 }
  }));

  const text = (resp.output?.message?.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(text);
  return normalize(parsed, 'bedrock');
}

async function gradeWithGemini(buffer, mime) {
  const { GoogleGenAI } = require('@google/genai');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const resp = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      { inlineData: { mimeType: mime || 'image/jpeg', data: buffer.toString('base64') } },
      { text: PROMPT }
    ]
  });
  const text = (resp.text || '').replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(text);
  return normalize(parsed, 'gemini');
}

async function grade(buffer, mime) {
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    try { return await gradeWithBedrock(buffer, mime); }
    catch (e) { console.error('Bedrock failed, trying next:', e.message); }
  }
  if (process.env.GEMINI_API_KEY) {
    try { return await gradeWithGemini(buffer, mime); }
    catch (e) { console.error('Gemini failed, using mock:', e.message); }
  }
  return mockGrade(buffer);
}

module.exports = { grade };
