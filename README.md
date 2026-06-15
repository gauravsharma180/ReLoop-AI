# ReLoop-AI 

AI-powered returns intake. Upload a photo of a returned item; the system grades
its condition and routes it to its **next best life** — Resell, Refurbish, Exchange,
Donate, Recycle, or Inspect — with resale value, green credits, and CO₂ saved.
Every result renders as a **Product Health Card**: verdict, condition, history,
and warranty status at a glance.

## The design rule that makes it defensible
**AI judges condition. Code decides routing.** The vision model only assesses the
photo (grade A–D, flaws, confidence). The decision, price, credits, and CO₂ all
come from a deterministic rule engine + catalog — so every number is explainable,
not hallucinated. That answers the "can you trust the grade?" question directly.

## Run it (2 terminals)

### Backend
```bash
cd backend
npm install
cp .env.example .env    
npm start             
```
Without any keys it runs in **demo mode**: deterministic grading from the image bytes,
so the demo works end-to-end and never depends on a live API.

### Frontend
```bash
cd frontend
npm install
npm run dev               
```

## What's inside
```
backend/
  routes/grade.js          # validate -> cache -> AI -> rules -> enrich
  routes/predictReturn.js  # differentiator: return-risk score at checkout
  services/ai.js           # vision call (Bedrock Nova Lite -> Gemini -> mock fallback chain)
  services/rules.js        # the decision engine — point judges here
  services/enrich.js       # price / credits / CO2 / recs + running impact
  services/cache.js        # demo-safety: same photo -> same instant result
  data/catalog.json        # reference prices, CO2, refurb recs
frontend/
  src/components/ResultCard.jsx    # the Product Health Card: verdict, history, warranty, reasoning
  src/components/UploadScreen.jsx  # drag-drop intake
  src/components/CheckoutScreen.jsx # differentiator: live return-risk score + nudge
  src/components/ImpactCounter.jsx
```

## Endpoints
- `POST /grade` (multipart `image`) → graded routing decision
- `POST /predict-return` (JSON order signals) → return-risk score + nudge
- `GET /impact` → cumulative items / ₹ recovered / CO₂ / credits

## Vision grading chain
`services/ai.js` tries each path in order, falling back if a step is
unavailable or errors — the rest of the pipeline (rules, enrich, cache, UI)
never changes regardless of which one is active:
1. **Amazon Bedrock, Nova Lite** (`amazon.nova-lite-v1:0`) — used if
   `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` are set. Needs Bedrock model
   access enabled for Nova Lite in `AWS_REGION` (default `us-east-1`).
2. **Google Gemini** (`gemini-2.5-flash`) — used if `GEMINI_API_KEY` is set.
3. **Deterministic mock** — derived from the image hash, no keys needed.


