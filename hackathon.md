# Hackathon log

- **Project:** Whisker Watch
- **Event:** Convex All Gas Hackathon (sponsored by OpenAI, Firecrawl, AgentMail)
- **What it does:** Live cat-adoption radar: save coat/age/distance preferences, Firecrawl ingests public shelter listings, Convex matches them in realtime, and AgentMail emails you before the cat is gone.
- **Live app:** https://kindly-panther-329.convex.site
- **Repo:** https://github.com/weeb3dev/whisker-watch
- **Frontend:** Convex static hosting
- **Convex deployment:** https://kindly-panther-329.convex.cloud
- **Components:** @convex-dev/static-hosting
- **Convex features:** schema, tables, indexes, queries, mutations, actions, HTTP actions, crons, scheduled functions, realtime queries
- **Auth:** Convex Auth
- **AI models:** gpt-4o-mini (optional re-scoring via `OPENAI_API_KEY`; `OPENAI_BASE_URL` can point at an OpenAI-compatible gateway)
- **Demo video:** pending
- **Social post:** pending
- **Started:** 2026-09-11T01:20:27Z
- **Last updated:** 2026-09-17T21:30:00Z

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

### 2026-09-17 - 48a9884
Shipped to Convex cloud and verified the full pipeline live. `npm run deploy`
built the SPA with the prod `VITE_CONVEX_URL`, deployed the backend, and
uploaded `dist/` to Convex storage via `@convex-dev/static-hosting`; the app
is live at https://kindly-panther-329.convex.site (backend
https://kindly-panther-329.convex.cloud). Generated the RS256 auth keypair and
set `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL` on the deployment (the four runtime
keys were already set). Live proofs against the deployment: a Firecrawl
Petfinder run recorded `mode: "live"` with 12 listings carrying
source/url/coat/age/location; matches recorded with `scoredBy: "llm"` (real
OpenAI re-scoring); the match board updated over a websocket push after a
reset + rescan with no refresh; and AgentMail alerts reached `status: "sent"`
with `provider: "agentmail"` (Amazon SES message ids) whose bodies link the
listing URL, with the real emails delivered to the test recipient. All four
`scripts/verify-*.mjs` pass against the deployment. Convex features: static
hosting component, actions, crons, realtime queries.

## Stack checklist

- [x] **Convex backend**: schema, indexes, queries, mutations, actions, crons, scheduled functions, realtime subscriptions.
- [x] **Convex Auth**: password provider; watcher creation requires sign-in.
- [x] **Firecrawl**: real scraping of Petfinder via `/v2/scrape` JSON extraction; PetSmart fixture fallback recorded on the IngestRun.
- [x] **AgentMail**: real send path against `api.agentmail.to`; outbox mock when credentials are absent. Verified live: alerts sent through AgentMail (Amazon SES message ids), bodies link the listing URL.
- [x] **OpenAI**: optional LLM re-scoring of matches on top of deterministic rules. Verified live: matches recorded with `scoredBy: "llm"`.
- [x] **Convex static hosting component**: frontend served from `*.convex.site`.
- [x] **Public GitHub repo**: https://github.com/weeb3dev/whisker-watch.
- [x] **Live URL on convex.site**: https://kindly-panther-329.convex.site (served by `@convex-dev/static-hosting`).
- [ ] **Demo video (under 3 min)** and **social post** tagging @convex @OpenAI @firecrawl @agentmail.
- [ ] **Submitted at vibeapps.dev** before Sep 22 2026 12:00 PM PT.

## Submission status

| Surface | URL | Status |
| --- | --- | --- |
| Live app (convex.site) | https://kindly-panther-329.convex.site | live |
| Convex deployment | https://kindly-panther-329.convex.cloud | live |
| Public GitHub repo | https://github.com/weeb3dev/whisker-watch | pushed |
| Demo video | pending | pending |
| Social post | pending | pending |
| vibeapps.dev submission | pending | pending (deadline Sep 22 2026 12:00 PM PT) |

Everything above runs and is verified live against the Convex cloud
deployment. `npm run deploy` shipped the backend and the SPA (served from
`*.convex.site` by `@convex-dev/static-hosting`); runtime keys (Firecrawl,
AgentMail, OpenAI) plus the auth keypair (`JWT_PRIVATE_KEY`, `JWKS`,
`SITE_URL`) are set on the deployment. The four `scripts/verify-*.mjs` pass
against it and the real alert emails were delivered to the test recipient.

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
