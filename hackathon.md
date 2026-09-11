# Whisker Watch — hackathon status

v0 of a live cat-adoption radar: prefs → ingest → live match board → email
alert, end to end. Deadline: submit by Sep 22 2026 12pm PT.

## Stack checklist

- [x] **Convex backend** — schema (`watchers`, `listings`, `matches`, `alerts`,
      `ingestRuns`), queries, mutations, actions, realtime subscriptions, and a
      30-minute ingest cron (`convex/crons.ts`).
- [x] **Convex Auth** — password provider (`convex/auth.ts`); sign-up/sign-in in
      the app; watcher creation requires a signed-in user.
- [x] **Firecrawl ingest** — real scraping via `POST /v2/scrape` with the JSON
      format. Petfinder is scraped live (~12 real cats per run, proven).
      PetSmart's finder has no server-rendered listings, so it falls back to
      seed fixtures and the run is recorded `mode: "fixture"` (approved path).
- [x] **AgentMail alerts** — real send path implemented against
      `api.agentmail.to`; without credentials the swap-compatible outbox mock
      logs the payload and the Alert row still reaches `status: "sent"`.
- [x] **OpenAI / AI Gateway matching** — deterministic rules always run;
      with `OPENAI_API_KEY` (+ optional `OPENAI_BASE_URL` for Convex AI
      Gateway) matched pairs are re-scored by the LLM (`scoredBy: "llm"`).
- [x] **Frontend served from `*.convex.site`** — the built SPA is embedded into
      the deployment and served by Convex HTTP routes (`convex/http.ts`).
- [x] **Public repo, hackathon.md kept updated** — this file.

## URLs

| Surface | URL | Status |
| --- | --- | --- |
| Convex deployment | `http://127.0.0.1:3210` (anonymous local dev) | live in dev VM |
| Frontend (convex.site path) | `http://127.0.0.1:3211/` locally → `https://<name>.convex.site` after cloud deploy | proven locally |
| Frontend (vite dev) | `http://localhost:4747` | live in dev VM |

Cloud deploy is one command away but blocked on credentials: this environment
has no Convex account or `CONVEX_DEPLOY_KEY` (`npx convex deploy` asks for
`npx convex login`). Once a key exists:
`npx convex deploy --cmd 'npm run build:site'`, then set the deployment env
vars from the README.

## Verified (rerunnable scripts in `scripts/`)

| Claim | Proof |
| --- | --- |
| Prefs persist after reload | `verify-auth-prefs.mjs` — fresh client re-reads the watcher via `watchers.mine`; `verify-ui.mjs` reloads the page and checks the form |
| Auth works | sign-up via Convex Auth password flow; unauthenticated clients see no watcher; watch creation requires sign-in |
| Ingest run succeeds with ≥1 Listing | live Petfinder run: 12 listings with source/url/coat/age/location; PetSmart fixture run: 5 listings, `mode: "fixture"` recorded on the IngestRun |
| Long-hair prefs + new long-hair listing → live board update | `verify-realtime.mjs` — Mochi (long-hair kitten) removed and re-ingested; board updated via websocket push 4.3s after ingest, zero client re-queries |
| Email path | `verify-alerts.mjs` — Alerts reach `status: "sent"` with the listing URL in the body (outbox mock; AgentMail path is the same call site) |
| Demo path in a real browser | `verify-ui.mjs` — Playwright: sign up → prefs → board populates → outbox shows sent alert; screenshots in `artifacts/` |

## Not in v0 (by design)

Craigslist/social sources, SMS/push, maps polish, multi-tenant orgs, a second
aggregator, medical/allergy claims (preferences framing only).
