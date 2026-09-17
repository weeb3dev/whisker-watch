# Whisker Watch

Live cat-adoption radar. Set coat, age, and distance preferences plus an alert
email; Whisker Watch ingests public cat listings (Petfinder + PetSmart), matches
them in Convex, shows a realtime match board, and emails you via AgentMail the
moment a matching cat appears — before the cat is gone.

Coat and age are style preferences only. Whisker Watch makes no medical or
allergy claims.

## How it works

```
Firecrawl scrape (Petfinder live / PetSmart fixture fallback)
        │ ingest.run (action, also on a 30-min cron)
        ▼
Listing upserts (idempotent on source+externalId) + IngestRun audit row
        │ new listing → matcher.matchListing        watcher saved → matcher.matchWatcher
        ▼
Match rows (rules: coat ∧ age ∧ distance; optional LLM re-score) with score + reasons
        │ new match → alerts.sendForMatch
        ▼
Alert email via AgentMail (or logged outbox mock) + Alert row (status=sent)
        ▼
Match board UI updates live over a Convex subscription — no refresh
```

Domain model (Convex tables): `watchers`, `listings`, `matches`, `alerts`,
`ingestRuns`. See `convex/schema.ts`.

## Setup

```bash
npm install
npx convex dev          # terminal 1 — backend (anonymous local dev works out of the box)
npm run dev             # terminal 2 — frontend on http://localhost:4747
```

Convex Auth needs three env vars on the deployment (one-time):

```bash
node --input-type=module -e "
import { exportJWK, exportPKCS8, generateKeyPair } from 'jose';
import { writeFileSync } from 'fs';
const keys = await generateKeyPair('RS256', { extractable: true });
writeFileSync('/tmp/jwt_private_key.pem', await exportPKCS8(keys.privateKey));
writeFileSync('/tmp/jwks.json', JSON.stringify({ keys: [{ use: 'sig', ...await exportJWK(keys.publicKey) }] }));
"
npx convex env set JWT_PRIVATE_KEY -- "$(cat /tmp/jwt_private_key.pem)"
npx convex env set JWKS -- "$(cat /tmp/jwks.json)"
npx convex env set SITE_URL http://localhost:4747
```

## Environment variables (all set with `npx convex env set NAME value`)

| Variable | Required? | Behavior when missing |
| --- | --- | --- |
| `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL` | yes (auth) | sign-in fails |
| `FIRECRAWL_API_KEY` | no | Firecrawl is called keyless at its free rate limit; Petfinder live scraping works either way |
| `AGENTMAIL_API_KEY`, `AGENTMAIL_INBOX_ID` | no | alerts use the logged **outbox mock** (same payload, `provider: "outbox"`, still `status: "sent"`) |
| `OPENAI_API_KEY` | no | matcher uses deterministic rules only (`scoredBy: "rules"`) |
| `OPENAI_BASE_URL`, `OPENAI_MODEL` | no | point at any OpenAI-compatible endpoint (e.g. Convex AI Gateway); default `api.openai.com` / `gpt-4o-mini` |

Switching a mock to the real path is only setting the env vars — no code
changes. The AgentMail sender posts to
`POST https://api.agentmail.to/v0/inboxes/{AGENTMAIL_INBOX_ID}/messages/send`.

## Scrape targets

- **Petfinder** (live): `https://www.petfinder.com/search/cats-for-adoption/us/{state}/{zip}/`,
  extracted with Firecrawl's JSON format. Proven live: returns ~12 real cats per scrape.
- **PetSmart** (fixture fallback): `https://www.petsmartcharities.org/adopt-a-pet`
  renders its finder client-side with no per-cat pages, so live extraction is
  rejected at the URL-shape boundary and ingest records a `mode: "fixture"` run
  seeded from `convex/fixtures.ts`.

## Demo script (~2 minutes)

1. Open the app, create an account (email + password).
2. Save a watch: zip `94103`, 50 miles, coat **long**, age **kitten** + **young**.
3. The match radar populates within seconds (matcher runs on watcher save).
4. Press **Scan now** — ingest runs both sources; watch the IngestRuns table.
5. Simulate a new cat appearing: `npx convex run dev:resetSource '{"source": "petsmart"}'`
   (board shrinks live), then **Scan now** again — Mochi reappears on the board
   without a refresh, and the **Alert outbox** shows the sent email with the
   listing link.

## Verification (rerunnable proofs against the live deployment)

```bash
node scripts/verify-auth-prefs.mjs   # auth + prefs persist across reload
node scripts/verify-realtime.mjs     # board updates via websocket push, no refresh
node scripts/verify-alerts.mjs       # Alert.status === "sent", body links listing URL
node scripts/verify-ui.mjs           # real-browser demo path (Playwright, screenshots in artifacts/)
```

## Deploying to Convex cloud

The SPA is served by the Convex deployment itself on its `.convex.site` domain
through the official [`@convex-dev/static-hosting`](https://github.com/get-convex/static-hosting)
component (`convex/convex.config.ts`, `registerStaticRoutes` in `convex/http.ts`).

Runbook (needs `CONVEX_DEPLOY_KEY` in the environment, or `npx convex login`):

```bash
# 1. Build the frontend with the prod VITE_CONVEX_URL, deploy the backend, upload dist/
npm run deploy
# prints: Your app is now available at: https://<deployment>.convex.site

# 2. One-time prod auth setup: generate keys (jose snippet in Setup above), then
npx convex env set JWT_PRIVATE_KEY --prod -- "$(cat /tmp/jwt_private_key.pem)"
npx convex env set JWKS --prod -- "$(cat /tmp/jwks.json)"
npx convex env set SITE_URL --prod https://<deployment>.convex.site
rm /tmp/jwt_private_key.pem /tmp/jwks.json

# 3. Confirm runtime keys are present (names only; never print values)
npx convex env list --prod | cut -d= -f1
#   expect FIRECRAWL_API_KEY, AGENTMAIL_API_KEY, AGENTMAIL_INBOX_ID, OPENAI_API_KEY
```

Then verify on the live URL (sign up, save long-hair prefs, Scan now, board
populates) and rerun the proof scripts against prod:

```bash
CONVEX_URL=https://<deployment>.convex.cloud SITE_URL=https://<deployment>.convex.site \
  node scripts/verify-ui.mjs
```

Finally record the live URL, Convex deployment URL, repo URL, demo video, and
social post in `hackathon.md`.

Notes:
- `npx convex env list` prints values in full, including multi-line PEM keys.
  Pipe through `cut -d= -f1` when checking which vars exist.
- Convex AI Gateway is available to paid Convex plans only; on a free plan the
  `OPENAI_API_KEY` path is the one that runs.
- Secrets never go in the repo: `.gitignore` excludes `.env*`, `*.pem`, `*.key`.
  In Cursor Cloud Agents, store `CONVEX_DEPLOY_KEY` as a Runtime Secret.
