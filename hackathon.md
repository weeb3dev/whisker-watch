# Hackathon log

- **Project:** Whisker Watch
- **Event:** Convex All Gas Hackathon (sponsored by OpenAI, Firecrawl, AgentMail)
- **What it does:** Live cat-adoption radar: save coat/age/distance preferences, Firecrawl ingests public shelter listings, Convex matches them in realtime, and AgentMail emails you before the cat is gone.
- **Live app:** not deployed (pending: `https://<deployment>.convex.site`, see Submission status)
- **Repo:** pending (public GitHub URL: `https://github.com/weeb3dev/whisker-watch`)
- **Frontend:** Convex static hosting
- **Convex deployment:** not deployed (pending `*.convex.cloud`)
- **Components:** @convex-dev/static-hosting
- **Convex features:** schema, tables, indexes, queries, mutations, actions, HTTP actions, crons, scheduled functions, realtime queries
- **Auth:** Convex Auth
- **AI models:** gpt-4o-mini (optional re-scoring via `OPENAI_API_KEY`; `OPENAI_BASE_URL` can point at an OpenAI-compatible gateway)
- **Demo video:** pending
- **Social post:** pending
- **Started:** 2026-09-11T01:20:27Z
- **Last updated:** 2026-09-17T20:18:32Z

## Log

### 2026-09-11 - 3fc0c85
Modeled the domain first: `watchers`, `listings`, `matches`, `alerts`,
`ingestRuns` with shared coat/age unions so illegal states cannot enter from
the form or the scraper. Identity indexes `listings.by_source_externalId` and
`matches.by_watcher_listing` make ingest and matching idempotent. Convex
features: schema, tables, indexes (`convex/schema.ts`).

### 2026-09-11 - d288055
Added Convex Auth with the password provider and the watcher preferences form
(zip, max miles, coats, ages, alert email). Watch creation requires a signed-in
user; saving a watcher schedules the matcher. Convex features: Convex Auth,
queries, mutations, scheduled functions (`convex/auth.ts`,
`convex/auth.config.ts`, `convex/watchers.ts`, `src/App.tsx`).

### 2026-09-11 - 5670b2a
Firecrawl ingest via `POST /v2/scrape` with JSON extraction. Petfinder is
scraped live (about 12 real cats per run). PetSmart's finder renders
client-side with no per-cat pages, so a URL-shape validator rejects extracted
"cats" and the run falls back to seed fixtures recorded as `mode: "fixture"`.
Each run upserts listings and writes an `ingestRuns` audit row; a 30-minute
cron re-runs both sources. Convex features: actions, internal mutations, crons,
scheduled functions (`convex/ingest.ts`, `convex/fixtures.ts`,
`convex/crons.ts`).

### 2026-09-11 - 5f06fcd
Matcher runs deterministic rules (coat and age and distance from zip) and
optionally re-scores matched pairs with OpenAI (`scoredBy: "llm"`), writing
`matches` rows with score and reasons. Every new match schedules an alert:
the AgentMail sender posts to the inbox messages endpoint; without credentials a
swap-compatible outbox mock logs the same payload and the `alerts` row still
reaches `status: "sent"` with the listing URL in the body. Convex features:
internal actions, mutations, scheduled functions (`convex/matcher.ts`,
`convex/alerts.ts`, `convex/geo.ts`).

### 2026-09-11 - 2eea32d
Live match board, ingest panel with a Scan now button, and an in-app alert
outbox, all driven by Convex subscriptions. A realtime proof script removes and
re-ingests a long-hair kitten and observes the board update over the websocket
with zero client re-queries. Convex features: realtime queries
(`src/App.tsx`, `scripts/verify-realtime.mjs`).

### 2026-09-11 - a5bbe3a
Served the built SPA from the deployment's `.convex.site` domain through HTTP
routes, replaced the seeded README with setup, env var, scrape target, and demo
docs, and added a Playwright pass that signs up, saves prefs, watches the board
populate, opens the outbox, and reloads to confirm prefs persist (screenshots
in `artifacts/`). Convex features: HTTP actions (`convex/http.ts`,
`scripts/verify-ui.mjs`).

### 2026-09-17 - 12d5ac1
Moved frontend hosting to the official `@convex-dev/static-hosting` component:
`registerStaticRoutes` in `convex/http.ts`, `app.use(staticHosting)` in
`convex/convex.config.ts`, and `npm run deploy` builds, deploys the backend,
and uploads `dist/` to Convex storage. Verified locally: SPA at `/`, immutable
cache headers on hashed assets, SPA fallback, auth routes intact, Playwright
demo path still passes. Hardened `.gitignore` so env files and key material can
never be committed. Convex features: registered component, HTTP actions.

## Stack checklist

- [x] **Convex backend**: schema, indexes, queries, mutations, actions, crons, scheduled functions, realtime subscriptions.
- [x] **Convex Auth**: password provider; watcher creation requires sign-in.
- [x] **Firecrawl**: real scraping of Petfinder via `/v2/scrape` JSON extraction; PetSmart fixture fallback recorded on the IngestRun.
- [x] **AgentMail**: real send path against `api.agentmail.to`; outbox mock when credentials are absent.
- [x] **OpenAI**: optional LLM re-scoring of matches on top of deterministic rules.
- [x] **Convex static hosting component**: frontend served from `*.convex.site`.
- [ ] **Public GitHub repo**: pending push to `weeb3dev/whisker-watch`.
- [ ] **Live URL on convex.site**: pending `npm run deploy` with `CONVEX_DEPLOY_KEY`.
- [ ] **Demo video (under 3 min)** and **social post** tagging @convex @OpenAI @firecrawl @agentmail.
- [ ] **Submitted at vibeapps.dev** before Sep 22 2026 12:00 PM PT.

## Submission status

| Surface | URL | Status |
| --- | --- | --- |
| Live app (convex.site) | pending | deploy next: `npm run deploy` (README, "Deploying to Convex cloud") |
| Convex deployment | pending | |
| Public GitHub repo | `https://github.com/weeb3dev/whisker-watch` | pending push |
| Demo video | pending | |
| Social post | pending | |

Everything above runs and is verified against a local anonymous Convex
deployment in the dev environment (`http://127.0.0.1:3211`). The cloud deploy
is one command once `CONVEX_DEPLOY_KEY` is present in the agent environment;
runtime keys (Firecrawl, AgentMail, OpenAI) are already set on the Convex
deployment.

## Verified (rerunnable scripts in `scripts/`)

| Claim | Proof |
| --- | --- |
| Prefs persist after reload | `verify-auth-prefs.mjs`: fresh client re-reads the watcher via `watchers.mine`; `verify-ui.mjs` reloads the page and checks the form |
| Auth works | sign-up via Convex Auth password flow; unauthenticated clients see no watcher; watch creation requires sign-in |
| Ingest run succeeds with at least one Listing | live Petfinder run: 12 listings with source/url/coat/age/location; PetSmart fixture run: 5 listings, `mode: "fixture"` recorded on the IngestRun |
| Long-hair prefs + new long-hair listing updates the board live | `verify-realtime.mjs`: a long-hair kitten is removed and re-ingested; board updated via websocket push in about 4s, zero client re-queries |
| Email path | `verify-alerts.mjs`: alerts reach `status: "sent"` with the listing URL in the body (outbox mock locally; AgentMail is the same call site) |
| Demo path in a real browser | `verify-ui.mjs` (Playwright): sign up, prefs, board populates, outbox shows the sent alert, reload keeps prefs; screenshots in `artifacts/` |

## Not in v0 (by design)

Craigslist/social sources, SMS/push, maps polish, multi-tenant orgs, a second
aggregator, medical/allergy claims (preferences framing only).
