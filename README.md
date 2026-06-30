# ReLoop-AI

## Theme : Second Life Commerce — AI-Powered Returns & Sustainable Resale

## Problem Statement

Every year, billions of dollars in returned products move through warehouses with no intelligent decision layer. Up to $816B in U.S. retail merchandise is returned annually, and roughly 25% of returned goods end up in landfill instead of being resold, refurbished, or donated, because a human must manually inspect each item, guess its value, and decide its fate — slow, inconsistent, and expensive at scale. The overarching objective is to build an AI-driven system that can look at a returned item, judge its condition, and route it to its next best life — resell, refurbish, donate, recycle, or exchange — while giving customers, sellers, and the platform a transparent, explainable reason for every decision. The key elements of the problem are: a) using vision AI to grade the physical condition of a returned item from a photo or short video, detecting flaws, damage, and signs of prior use; b) converting that condition grade into a routing decision, resale price, green credits, and CO₂ impact through logic that is fully auditable, not a black box; and c) predicting, before checkout, whether an order is likely to be returned at all — so some returns never happen in the first place.

## Description

ReLoop-AI is an AI-powered returns intake system. A seller, warehouse operator, or shopper uploads a photo (or short video) of a returned item, and the system grades its condition and routes it to its **next best life** — Resell, Refurbish, Exchange, Donate, Recycle, or Inspect — along with resale value, green credits earned, and CO₂ saved. Every result renders as a **Product Health Card**: verdict, condition, flaws, confidence, history, and warranty status at a glance.

The core design principle is a deliberate split between perception and decision. **AI judges condition. Code decides routing.** The vision model (Amazon Bedrock Nova Lite, with Google Gemini and a deterministic mock as fallbacks) only assesses the photo — grade A–D, detected flaws, and a confidence score. The routing decision, resale price, green credits, and CO₂ impact all come from a deterministic rule engine plus a reference catalog — so every number on the Product Health Card is explainable and traceable to a rule, never hallucinated. This directly answers the "can you trust the grade?" question that makes refurbished goods hard to trust today.

We also fold in two safety layers: a **return-fraud check** that flags items showing signs of prior use despite being returned as "new" and downgrades their routing accordingly, and an **input guardrail** that rejects non-product images (e.g. a photo of a hand) instead of inventing a fake grade and price. For video uploads, the system samples multiple frames, grades each independently, and takes the worst-case grade across all of them — so damage on one side of an item cannot hide from the system. A parallel **Predict Return Risk** feature scores an order's checkout signals (category, price, size selection, return history, review average) as HIGH / MEDIUM / LOW before the order ships, with a suggested nudge to prevent the return altogether.

Beyond the core grading flow, ReLoop-AI also includes user accounts with per-user grading history, an operator feedback loop for measuring real routing accuracy, and a location-aware peer-to-peer exchange marketplace — letting any graded item be listed for direct exchange with nearby users instead of (or alongside) the AI's recommended routing.

## Block Diagram

**System Architecture**

```mermaid
flowchart TB
    subgraph Frontend["Frontend (React + Vite)"]
        Upload["UploadScreen.jsx\ndrag-drop intake"]
        Result["ResultCard.jsx\nProduct Health Card"]
        Checkout["CheckoutScreen.jsx\nreturn-risk score + nudge"]
        Impact["ImpactCounter.jsx\ncumulative impact"]
        Auth["LoginPage / RegisterPage\nJWT auth"]
        History["HistoryPage.jsx\npast grades + feedback"]
        Exchange["ExchangePage.jsx\nP2P listings"]
        Notif["NotificationBell.jsx\nin-app alerts"]
    end

    subgraph Backend["Backend (Node + Express)"]
        AuthRoute["routes/auth.js"]
        GradeRoute["routes/grade.js"]
        GradeVideoRoute["routes/gradeVideo.js"]
        PredictRoute["routes/predictReturn.js"]
        HistoryRoute["routes/history.js"]
        ExchangeRoute["routes/exchange.js"]
        InterestRoute["routes/interest.js"]
        NotifRoute["routes/notifications.js"]
        LocationRoute["routes/location.js"]
        AI["services/ai.js\nvision grading"]
        Rules["services/rules.js\ndecision engine"]
        Enrich["services/enrich.js\nprice / credits / CO2"]
        Cache["services/cache.js\ndemo safety"]
        Distance["utils/distance.js\nHaversine matching"]
        Catalog["data/catalog.json"]
    end

    subgraph Data["Data Layer"]
        Postgres[("PostgreSQL\nusers, grades, exchange_listings,\ninterest_list, notifications, impact")]
    end

    Auth -->|"POST /auth/register, /login"| AuthRoute --> Postgres
    Upload -->|"POST /grade"| GradeRoute
    Upload -->|"POST /grade-video"| GradeVideoRoute
    Checkout -->|"POST /predict-return"| PredictRoute
    Impact -->|"GET /impact"| Postgres
    History -->|"GET /history, feedback"| HistoryRoute --> Postgres
    Exchange -->|"list / claim / browse"| ExchangeRoute --> Distance
    ExchangeRoute --> Postgres
    Notif -->|"GET /notifications"| NotifRoute --> Postgres

    GradeRoute --> Cache
    GradeRoute --> AI --> Rules --> Enrich
    GradeVideoRoute --> AI
    Enrich --> Catalog
    Enrich --> Postgres
    Enrich --> Result
```

**Vision Grading Chain (fallback order)**

```mermaid
flowchart LR
    Input["Photo / Video"] --> Bedrock{"Amazon Bedrock\nNova Lite"}
    Bedrock -->|"AWS keys set & success"| Output["Grade result\n(grade, flaws, confidence)"]
    Bedrock -->|"unavailable / error"| Gemini{"Google Gemini\ngemini-2.5-flash"}
    Gemini -->|"GEMINI_API_KEY set & success"| Output
    Gemini -->|"unavailable / error"| Mock["Deterministic mock\n(from image hash)"]
    Mock --> Output
```

All three paths share an identical prompt and JSON contract, so the rest of the pipeline (rules, enrichment, cache, UI) never changes regardless of which one is active.

**P2P Exchange Matching**

```mermaid
flowchart LR
    List["Item listed for exchange"] --> Find["Find users interested\nin category"]
    Find --> Filter["Filter by distance\n(Haversine, 10km radius)"]
    Filter --> Notify["Create notification\nfor each matched user"]
    Notify --> Bell["User sees notification bell\nclicks → claims item"]
```

## Tech Stack

- **React + Vite**: Frontend development framework — upload screen, Product Health Card, impact counter, return-risk form, exchange board, notifications.
- **Node.js + Express**: Backend development framework — exposes `/grade`, `/grade-video`, `/predict-return`, `/impact`, `/auth`, `/history`, `/exchange`, `/interest`, `/notifications`, `/location`.
- **PostgreSQL**: Primary data store — users, grades, exchange listings, interest lists, notifications, and impact totals, with connection pooling via `pg`.
- **JWT Authentication**: Stateless user auth — register/login, protected routes, role-based access (`operator` / `admin`).
- **Amazon Bedrock (Nova Lite)**: Primary vision model for condition grading (grade A–D, flaws, confidence).
- **Google Gemini (gemini-2.5-flash)**: Automatic fallback vision model, same prompt/JSON contract as Bedrock.
- **Deterministic mock grading**: Final fallback derived from image hash — demo always runs end-to-end without any API keys.
- **Rule Engine + Catalog (JSON)**: Pure, deterministic decision layer — maps grade, confidence, used-as-new risk, and category to routing decision, resale price, green credits, and CO₂ saved.
- **Haversine-based proximity matching**: Powers the P2P exchange marketplace — matches and notifies only users within a configurable radius (default 10km) who have registered interest in that item's category.
- **Multer + Form-Data**: Multipart image/video upload handling on the backend.

## Project Features

### AI Condition Grading (Photo or Video)

1. **Grade a Return**: Upload a photo of a returned item; the vision model assesses condition and assigns a grade (A–D) with a confidence score and a list of detected flaws.
2. **Video Grading**: Upload a short video instead — the system samples 3 frames, grades each independently, and takes the worst-case grade across all frames so damage on any side of the item is caught.
3. **Demo Mode**: Without any API keys, grading runs deterministically from the image bytes, so the demo always works end-to-end and never depends on a live API.

### Explainable Rule-Engine Routing

1. **Product Health Card**: Every graded item renders as a card showing the verdict (Resell / Refurbish / Donate / Recycle / Exchange / Inspect), condition summary, detected flaws, confidence, estimated value, green credits earned, CO₂ kept out of landfill, return history, and warranty status — with a plain-English reason for the decision.
2. **Real Product Price Matching**: The AI-detected category and item name are matched against a reference catalog to pull the item's real original price, so resale value is grounded in real data, not guessed.
3. **Certified-Refurbished Recommendations**: Each card surfaces relevant certified-refurbished alternatives the customer might be interested in.

### Return-Fraud & Input Guardrails

1. **Return-Fraud Signal**: If an item shows clear signs of prior use despite being returned under a "new" claim, the system flags this and downgrades the routing (e.g. to certified refurbish instead of full resale).
2. **Non-Product Guardrail**: If the uploaded image doesn't show a sellable retail product (e.g. a photo of a hand), the system rejects it cleanly with a "Not a recognizable product" message instead of inventing a fake grade and price.

### Predict Return Risk (Checkout)

1. **Checkout Signals Form**: Captures product category, price, whether the customer selected a size, the customer's past return count, and the product's average review score.
2. **Return Risk Score**: Scores the order as HIGH / MEDIUM / LOW with a numeric risk percentage and a list of contributing factors (e.g. "High-return category," "No size selected," "Frequent returner," "Low review score"), shown before the order ships — with a suggested nudge to prevent the return.

### User Accounts & Grading History

1. **JWT Authentication**: Register and log in with email + password; protected routes verify a Bearer token on every request.
2. **Per-User Grading History**: Every graded item is saved against the user who graded it, viewable as a searchable history list.
3. **Operator Feedback Loop**: After a grade is shown, the user can mark the routing decision as correct or incorrect (👍 / 👎) — feedback is stored and aggregated into a real, measured routing accuracy rate, rather than an assumed one.
4. **Stats Dashboard**: Per-user statistics — grade distribution, routing breakdown, fraud-flag rate, low-confidence rate, and accuracy rate based on collected feedback.

### Peer-to-Peer Exchange Marketplace

1. **List Any Graded Item**: Any graded item can be listed for P2P exchange — the AI's routing decision acts as a recommendation, not a hard gate; the user decides whether to list it.
2. **Location-Aware Matching**: Uses the Haversine formula to calculate real-world distance between users; when an item is listed, only users within a 10km radius who registered interest in that category are matched.
3. **In-App Notifications**: Matched users receive an in-app notification (polled every 30 seconds) with a badge count on a notification bell — no need to manually browse for relevant items.
4. **Claim Flow**: Any matched or browsing user can claim an available listing; once claimed, it's removed from the available pool and tracked under both the lister's and claimer's "My Exchanges" view.

### Impact Tracking

1. **Running Impact Counter**: Tracks cumulative items rerouted, ₹ value recovered, CO₂ avoided, and green credits issued across all graded returns, persisted in PostgreSQL and shown live on the frontend via `GET /impact`.

## Installation Steps

### PostgreSQL

Create a local database (or use a hosted instance) and set the connection string:

```bash
# Example local Postgres setup
createdb reloop_ai
```

In `backend/.env`:
```
DATABASE_URL=postgresql://your_user:your_password@localhost:5432/reloop_ai
```

### Backend

```bash
cd backend
npm install
cp .env.example .env
# fill in DATABASE_URL, JWT_SECRET, AWS keys, GEMINI_API_KEY
npm start
```

Without AWS/Gemini keys, grading runs in **demo mode**: deterministic grading from the image bytes, so the demo works end-to-end and never depends on a live API.

To enable live grading, set in `.env`:
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` (default `us-east-1`) — enables Amazon Bedrock Nova Lite (requires Bedrock model access enabled for Nova Lite in your AWS region)
- `GEMINI_API_KEY` — enables Google Gemini as fallback if Bedrock is unavailable

### Frontend

```bash
cd frontend
npm install
npm run dev
```

To allow the P2P exchange location features, the browser will prompt for geolocation permission — this is read locally and sent only to your own backend.
