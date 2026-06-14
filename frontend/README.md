# SecondLife Commerce

AI returns-triage: upload a photo of a returned item -> AI grades condition ->
a deterministic rule engine routes it (Resell / Refurbish / Donate / Recycle)
with price, green credits, CO2 saved, and refurbished recommendations.

## Architecture
- **frontend/** React + Vite. UploadScreen + ResultCard + ImpactCounter.
- **backend/** Express. `POST /grade` runs: validate -> cache (demo safety) ->
  AI grade (Gemini vision, or a deterministic mock with no key) -> rule engine
  -> enrich (price/credits/CO2/recs). `GET /impact` for running totals.

Design rule: **AI judges condition only; plain code makes the routing decision.**
Every number traces to `services/rules.js` + `services/enrich.js` — explainable
to a judge, not a black box.

## Run
```bash
cd backend && npm install && npm start      # :5000  (no API key needed)
cd frontend && npm install && npm run dev    # :5173
```
Add a real `GEMINI_API_KEY` in `backend/.env` to grade live photos. Without it,
the app runs a deterministic demo mock so different images give different,
stable results.

## Before judging
Pre-seed `backend/services/cache.js` `demoResponses` with the md5 of your demo
images + their responses, so a dead/absent API can never break the live demo.

## Not built yet (pitch as roadmap)
- Predictive return prevention (`POST /predict-return`) — flag high-return-risk
  items at checkout, same pattern as /grade.
- Real donation/recycling partner APIs, P2P resale, green-credits wallet.
