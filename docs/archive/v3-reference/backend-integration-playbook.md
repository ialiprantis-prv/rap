# Backend Integration Playbook (v2.0 baseline)

How to switch from MSW mocks to the real backend, step by step. Read this when the backend developer says "endpoints are ready".

This is a living document. As we integrate real endpoints, mark them done in the checklist at the bottom.

---

## v2.0 baseline state

As of the `v2.0` tag (2026-05-28, `48a762f` on `v2-standards-aligned`):

- **45 endpoints** mocked via MSW (v1 ended at 35, v2 added 10 across the standards-alignment series). Full list with shapes in `docs/backend-endpoints.md`.
- **Standards-native shapes:** assets are CycloneDX 1.6 components with a `privact: { residesIn, rolfp, legacyCategory }` extension; vulnerabilities carry `cweRefs[]` + CVSS Base; threats carry ENISA 2022 category refs + STIX 2.1 shape preparation; controls + countermeasures carry NIST CSF v2.0 / CIS v8 / MITRE D3FEND refs.
- **Two override layers** added at the engine inputs:
  - Per-asset applicability override (`GET/PUT /projects/:id/applicability-overrides`, v2 commit 14) — see `docs/risk-engine-logic.md` "Applicability resolution".
  - Per-triplet CVSS Environmental severity override (`PATCH /projects/:id/triplets/:tid/env-override`, v2 commit 13) — see `docs/risk-engine-logic.md` "Severity resolution".
- **Two export formats added:** CycloneDX 1.6 BOM (`GET /projects/:id/report.cyclonedx.json`, commit 02) + OSCAL 1.1.2 Assessment Results (`GET /projects/:id/report.oscal.json`, commit 12).
- **One import format added:** CycloneDX 1.4 / 1.5 / 1.6 (`POST /projects/:id/import.cyclonedx`, commit 06).
- **PRIVACT methodology** is unchanged from v1: same formula, same scales, same bands, same ROLFP, same phase sequence. Standards data emits via the `x-privact:*` property namespace so methodology data round-trips through standard format adapters.

## Architecture boundary

TanStack Query hooks in `src/api/*` are the boundary between UI and data layer. They use `fetch()` internally; MSW intercepts at network level when active. **Real backend integration only requires implementing the endpoints — no UI changes.** Switch via:

1. Set `VITE_USE_MOCKS=false` in Vercel env (and remove `import.meta.env.DEV` short-circuit if no longer wanted in local dev).
2. Configure `VITE_API_BASE_URL` to point at the real backend.
3. Real backend implements all 45 endpoints with matching request/response shapes per `docs/backend-endpoints.md`.

## Phase E plan (next big thing — see `docs/next-phase-plan.md`)

Two sub-phases:

- **E1: Frontend abstraction cleanup.** Verify clean MSW vs real boundary. Error handling for real network conditions. Env switch verified. Retry logic + loading state polish.
- **E2: API contract document.** Self-contained specification for the backend developer. Builds on `docs/backend-endpoints.md` + this file. Includes request/response schemas, error response standardization, auth model, pagination/filtering conventions, performance expectations.

E2 is the deliverable to hand to the backend developer. After E2, backend implementation proceeds in parallel with optional E3 integration testing.

## Domain-specific notes for the backend developer

### Engine logic — recommendation: server-side compute

The frontend currently computes triplets and scores client-side (`src/lib/tripletGenerator.ts` + `riskComputation.ts` + `residualComputation.ts`). For backend integration: **keep compute server-side** (single source of truth, supports large project scaling, supports cross-tool integrations via API). Frontend retains the pure-function `lib/` modules as a reference implementation for parity verification.

### Standards catalogs — recommendation: frontend keeps as static reference

The frontend hardcodes catalog reference data (CWE-1000, ENISA Threat Taxonomy 2022, NIST CSF v2.0, CIS v8 Safeguards, MITRE D3FEND, ENISA actor model, CycloneDX 1.6 component vocabulary). **Frontend keeps these** (static, version-controlled, no backend round-trip needed for browsing). Backend only stores per-project state (selections, overrides, mitigations applied).

### Exports — recommendation: backend generates + serves

Currently generated client-side (`src/lib/cyclonedxAdapter.ts`, `oscalAdapter.ts`). For backend integration: **backend generates AND serves** the export files; frontend just downloads. This supports auth-required exports, audit trails, and full-fidelity rendering (the mock returns valid placeholder PDF/XLSX from `officeBlobs.ts`).

### Imports — recommendation: keep client-side parse

Currently parsed client-side via `cyclonedxImporter.ts`, persisted via API call. **Keep client-side parse** for immediate validation feedback to the user; backend just receives the parsed payload (`{ assets, services, links }`) for persistence.

### Override-driven recompute

Both v2 [13] env-override + v2 [14] applicability-override handlers regenerate triplets inline server-side when the override list changes. Backend must implement equivalent — either inline regen, or expose a clear refresh signal so the frontend knows when to invalidate caches.

---

## TL;DR — the 30,000-foot view

The frontend currently uses **MSW (Mock Service Worker)** to fake all backend calls. Every `fetch('/api/v1/...')` is intercepted in the browser and answered with a fake response.

To switch to a real backend, the change is conceptually small:

1. The MSW mocks stop running (or stop intercepting the specific endpoints that are now real).
2. The same `fetch('/api/v1/...')` calls now hit the real server.
3. Frontend doesn't change. **Same code, same URLs, different responder.**

That's the theory. The reality has details. This document covers them.

---

## End State — what PRIVACT becomes after backend integration

It helps to keep the destination in mind while reading the integration steps. PRIVACT is a multi-user tool: every user signs in through Keycloak and owns their own set of projects. The MSW world — one stubbed `Dev User`, four demo projects in localStorage — collapses into per-user, server-owned data the moment the real backend and auth realm come online. Nothing in the frontend's data shapes changes; the responder and the identity behind each request do.

The other big shift is the catalog. Today the threats, vulnerabilities, controls, countermeasures, and asset categories are hand-entered fixtures. In the integrated system the catalog is **dynamically sourced from external security libraries on the backend side** — the libraries referenced in D4.14 and currently anticipated are MAGERIT v3, EBIOS v2, NIST CSF, CIS v8 Safeguards, and MITRE D3FEND Countermeasures. The catalog grows and updates as those upstream libraries evolve, so the frontend cannot assume a fixed set of entries or a stable total count.

What does *not* change is the methodology. The 0-4 impact scales for CIA and ROLFP, the asset-category-based engine matching that produces applicable threats and vulnerabilities, the triplet risk calculation, and the mitigation planning against controls and countermeasures are all implemented in this codebase and stay stable regardless of which catalog version is active. The catalog supplies the *content*; this codebase supplies the *method*. A new MAGERIT revision or an added upstream library changes which threats appear, not how risk is computed.

Finally, a note on scale to set expectations. The D4.14 Risk Analysis Matrixes Excel was an AENAON healthcare case study used to *derive* the methodology, not a target dataset. The seed counts visible in the MSW handlers (12 threats / 18 vulnerabilities under `demo-2`) and the catalog totals currently quoted in `backend-endpoints.md` (55 / 96 / 7) are case-study reference scale, not target scale. Real catalog sizes depend on which upstream libraries get integrated and may be much larger.

---

## Phase 0 — Before the first integration meeting

Things to do **before** sitting down with the backend developer.

### 0.1 — Send them the contract

Share these files (commit them in a shared repo, or attach to an email):

- `docs/backend-endpoints.md` — full list of ~25 endpoints we need
- `docs/risk-engine-logic.md` — how the engine works (Phase 1-4 logic)
- `docs/screen-specs.md` — data shapes used per screen
- `docs/open-questions.md` — decisions we need from them
- This file (`docs/backend-integration-playbook.md`)

Say: *"This is the contract we built the frontend against. If you change any of it, tell me — small changes propagate to ~5-15 frontend files."*

### 0.2 — Agree on these things explicitly

Don't assume — write them down (add to `docs/open-questions.md` as resolved):

1. **Base URL.** Will it be `/api/v1/...` (same origin, reverse-proxied) or `https://api.privact.eu/v1/...` (different origin, CORS needed)?
2. **Authentication header format.** Probably `Authorization: Bearer <jwt>` from Keycloak. Confirm.
3. **Content type for requests.** JSON only, `Content-Type: application/json`. Confirm.
4. **Date format.** ISO 8601 strings (`"2026-05-19T10:30:00Z"`). Confirm.
5. **Error response format.** Standard shape across all endpoints, e.g.:
   ```json
   { "error": { "code": "VALIDATION_FAILED", "message": "...", "details": {...} } }
   ```
   Or whatever they prefer — just one shape, consistent.
6. **Pagination format.** For `GET /projects/{id}/triplets`. Recommend:
   ```json
   {
     "items": [...],
     "page": 1,
     "page_size": 50,
     "total": 4832,
     "total_pages": 97
   }
   ```
   Or cursor-based — depends on their preference.
7. **The `POST /compute` endpoint:** synchronous or asynchronous? (See `risk-engine-logic.md` — affects how the Triplets screen behaves.)
8. **CORS configuration.** If different origin, frontend's domain needs to be whitelisted on backend.

### 0.3 — Get the development URL

The backend dev should give you:
- A **dev server URL** (e.g. `https://dev-api.privact.eu` or `http://localhost:8080`)
- Credentials for a **test Keycloak realm** OR a way to bypass auth in dev (e.g. a static dev token)

If they're not ready to give you a URL yet, that's fine — keep using MSW. Don't start integrating until they have something to point at.

### 0.4 — Catalog data is dynamic, not from the case study Excel

The frontend was developed against D4.14 — the AENAON healthcare case study — with threats, vulnerabilities, and asset-category mappings hand-entered from that workbook. It is important to understand that the Excel is a **methodology source, not a data source**. The real catalog does not come from that file; it comes from online security libraries integrated on the backend (MAGERIT v3, EBIOS v2, NIST CSF, CIS v8 Safeguards, MITRE D3FEND Countermeasures).

This means the hardcoded counts in `backend-endpoints.md` ("55 threats", "96 vulnerabilities", "7 categories") are case-study totals, not contract sizes. Real catalog sizes will likely grow well beyond them — quite possibly 500+ threats and thousands of vulnerabilities once upstream integration matures. Similarly, the MSW seeds in `src/mocks/data/threatSeed.ts` and `vulnSeed.ts` (12 threats / 18 vulnerabilities under `demo-2`) are illustrative fixtures for development only. Backend developers should treat them as the contract for catalog **shape**, not **content**.

The one part of the catalog likely to stay stable is the asset categories — Application/API, Container, Container Network, Database, Hardware, Operating System, and TCP/IP (7 entries). These are an infrastructure-level taxonomy rather than a security-library export, so they are the least likely to churn as upstream libraries are added or revised.

See open questions in `docs/open-questions.md` § "Dynamic catalog architecture" for the specific items backend team must resolve.

---

## Phase 1 — First endpoint integration (just one, to prove the pipeline works)

Pick the **simplest endpoint** to integrate first. Recommendation: `GET /me`. It's just "return current user info" — minimal data, minimal logic, but exercises the full integration pipeline: auth header → real server → response handling → cache.

### 1.1 — Add environment configuration

In `risk-frontend/.env.development` (create if doesn't exist):

```
VITE_API_BASE_URL=http://localhost:8080
VITE_USE_MSW=true
```

In `risk-frontend/.env.production` (create if doesn't exist):

```
VITE_API_BASE_URL=https://api.privact.eu
VITE_USE_MSW=false
```

**Tell CLI Claude:**
> "Create `.env.development` and `.env.production` files at project root with the variables above. Also add `.env.*.local` to `.gitignore` so personal overrides don't get committed. Verify Vite reads `VITE_API_BASE_URL` correctly."

### 1.2 — Make MSW conditional

Currently MSW runs whenever `import.meta.env.DEV` is true. Change it to a more granular flag.

**Tell CLI Claude:**
> "In `src/main.tsx`, change the MSW enable check to use `import.meta.env.VITE_USE_MSW === 'true'` instead of `import.meta.env.DEV`. This lets us turn off MSW even in dev mode when we want to test against a real backend."

### 1.3 — Add a shared API client

Right now, fetch calls are probably scattered across components. Centralize them.

**Tell CLI Claude:**
> "Create `src/lib/apiClient.ts`. It should:
> - Export a function `apiGet<T>(path: string): Promise<T>` and similar for post/patch/delete.
> - Read `VITE_API_BASE_URL` and prepend it to all paths.
> - Read the auth token from wherever we store it (localStorage key `privact_token` for now — we'll wire Keycloak later) and add it as `Authorization: Bearer ...` header.
> - Throw a typed `ApiError` on non-2xx responses, with the response status and parsed error body.
> - Handle JSON serialization/deserialization automatically.
>
> Then refactor `src/pages/LoginPage.tsx` to use `apiGet('/api/v1/me')` instead of raw `fetch('/api/v1/me')`. Make sure MSW still intercepts it correctly."

### 1.4 — Test against MSW first

Before pointing at the real backend, make sure the new API client + MSW still works:

```bash
VITE_USE_MSW=true npm run dev
```

The Login screen should still behave exactly as before. If anything broke, fix it now while you can still isolate the cause.

### 1.5 — Point at the real backend (just for `/me`)

In `.env.development.local` (create — gitignored, local override):

```
VITE_USE_MSW=false
VITE_API_BASE_URL=http://localhost:8080
```

Get a test token from the backend dev (or a way to obtain one through Keycloak). Set it manually for now:

```javascript
// In browser DevTools Console:
localStorage.setItem('privact_token', 'eyJhbGciOiJSUzI1NiIs...')
```

Restart dev server. Load the Login screen.

**Expected behavior:**
- `/me` request goes to `http://localhost:8080/api/v1/me`
- Real backend responds with user info from Keycloak
- Login screen behaves as if authenticated (auto-redirects to `/projects`)

**If it fails:**
- 404 → wrong base URL or wrong path
- 401 → bad token or expired
- CORS error → backend didn't whitelist your origin
- Network error → backend not running

Each of these is a 5-minute fix in coordination with the backend dev. Tell them exactly what you see.

### 1.6 — Keep MSW for everything else

After `/me` works against real backend, **don't remove the MSW handlers**. Keep them. They serve as documentation of the expected contract AND as a safety net if the real backend goes down during development.

What we want is: per-endpoint switchover. As each endpoint is delivered by backend, you stop mocking that one specifically.

**Tell CLI Claude:**
> "Update `src/mocks/handlers.ts` so each handler can be individually toggled. Add a config object at the top like:
> ```ts
> const MOCKED_ENDPOINTS = {
>   me: false,        // backend handles this now
>   projects: true,   // still mocked
>   assets: true,
>   // ...
> };
> ```
> And conditionally include handlers based on the flags."

---

## Phase 2 — Integrating Auth (Keycloak)

This is the biggest single integration. Until now you're using localStorage stubs.

### 2.1 — Get from backend dev / consortium

1. Keycloak realm URL (e.g. `https://keycloak.privact.eu/realms/aenaon`)
2. OIDC client ID (e.g. `privact-frontend`)
3. Redirect URI(s) you should register (e.g. `http://localhost:5173/auth/callback`, `https://privact.eu/auth/callback`)
4. Logout URL behavior
5. Token expiration time and refresh strategy

### 2.2 — Install Keycloak adapter

**Tell CLI Claude:**
> "Install `@react-keycloak/web` and `keycloak-js`. Set up the Keycloak provider in `src/main.tsx` wrapping the app. Create `src/auth/keycloak.ts` with the Keycloak config (read URL and client ID from env vars `VITE_KEYCLOAK_URL` and `VITE_KEYCLOAK_CLIENT_ID`). Replace the `localStorage.privact_logged_in` stub in `LoginPage.tsx` with the real Keycloak login flow. The button should call `keycloak.login()`. On callback, `useKeycloak()` hook gives you the token."

### 2.3 — Update the API client to use the real token

**Tell CLI Claude:**
> "Update `src/lib/apiClient.ts` to get the auth token from the Keycloak instance instead of localStorage. Use `keycloak.token`. Add automatic token refresh logic: if a request returns 401, try `keycloak.updateToken(30)` and retry once."

### 2.4 — Test the full flow

1. Clear localStorage, clear cookies.
2. Visit `localhost:5173/login`
3. Click "Sign in with Keycloak" → real Keycloak login page opens
4. Enter test credentials
5. Redirects back → auto-redirects to `/projects`
6. Network tab: requests now include `Authorization: Bearer eyJ...` header
7. Sign-out flow clears Keycloak session, redirects to login

### 2.5 — Add new env vars

```
VITE_KEYCLOAK_URL=https://keycloak.privact.eu
VITE_KEYCLOAK_REALM=aenaon
VITE_KEYCLOAK_CLIENT_ID=privact-frontend
```

Different values in `.env.development` vs `.env.production`.

---

## Phase 3 — Integrating each business endpoint

For each endpoint the backend delivers, follow this 5-step process:

### Step A — Backend says "endpoint X is ready"

Ask them:
1. What's the **exact URL path**? (`/api/v1/projects/{id}/triplets`?)
2. What's the **exact request format**? (Query params? Body shape?)
3. What's the **exact response shape**? (JSON sample for success?)
4. What are the **error responses**? (What 4xx/5xx codes can it return?)
5. Any **side effects**? (Does this trigger a long computation? Email? Cascade delete?)

### Step B — Compare to our spec

Open `docs/backend-endpoints.md` and `docs/screen-specs.md`. Does what backend delivered match what we specced?

- If **yes** → easy. Proceed to step C.
- If **slightly different** → decide who adapts: them or us. Document the chosen contract.
- If **very different** → don't proceed. Sit down and reconcile. Otherwise the screens that use this endpoint will break.

### Step C — Update MSW to mirror reality

Before turning off the mock, **update the MSW handler to return exactly the same shape as the real backend.** This catches mismatches without involving the real backend.

**Tell CLI Claude:**
> "Update the MSW handler for `GET /api/v1/projects/{id}/triplets` to return this exact shape: `<paste the backend's response sample>`. Adjust the TypeScript types in `src/types/` if needed. Then run the app — does the relevant screen still work with the new shape?"

If the screen breaks, fix it now. The bug is in our frontend, not in the backend.

### Step D — Switch the toggle off

In `src/mocks/handlers.ts`, set the flag for this endpoint to `false`. Restart dev server. The screen now calls the real backend.

Test:
- Happy path (normal use)
- Empty state (what if backend returns 0 items?)
- Error state (what if backend returns 500?)
- Auth failure (what if token expired?)

### Step E — Commit and tell the team

```bash
git add -A
git commit -m "Integrate: GET /projects/{id}/triplets connected to real backend"
git push
```

Vercel auto-deploys. Send the preview URL to backend dev for verification.

Mark the endpoint done in the **checklist at the bottom of this file**.

---

## Phase 4 — The hard parts (compute, mitigations, exports)

These three need special handling beyond the standard 5-step process.

### 4.1 — `POST /compute` (Phase 3 triplet generation)

If backend chose **synchronous**: simple. The frontend `POST`s and waits. Show a full-screen overlay with progress text ("Computing risk scenarios... this may take a minute"). On response, show success and reload the triplets list.

If backend chose **asynchronous**: more complex. Need:
1. `POST /compute` returns a `job_id` immediately
2. `GET /compute-status?job_id=...` polled every 2 seconds, returns `{status: 'running' | 'done' | 'failed', progress: 0.45}`
3. Frontend polls until done, then refetches triplets

**Tell CLI Claude:**
> "Implement the async compute pattern in Phase 3 screen. Use TanStack Query's polling capability (`refetchInterval`). Show a progress modal during computation. On `failed`, show error toast and let user retry."

### 4.2 — `PATCH /mitigations` (Phase 4a live recompute)

This is the showcase feature. When user toggles a control checkbox, the residual risk number updates "live". Two strategies:

**Strategy A — Round-trip per toggle.** Each click sends a PATCH, backend recomputes, returns new residual risk. Simple but laggy if backend is slow.

**Strategy B — Optimistic UI.** Frontend immediately computes the predicted new residual risk (using the reduction percentages from the catalog). Shows that immediately. Sends the PATCH in background. If backend's actual number is different, reconcile silently or with a subtle update.

Recommend **Strategy A first**, upgrade to B if it feels too laggy. Less code complexity, fewer bugs.

**Tell CLI Claude:**
> "For Phase 4a Mitigations Planner, when user toggles a control: debounce 300ms, then send PATCH. Show button-level loading state during the request. On response, update the residual risk display. Use TanStack Query's `useMutation` with `onSuccess` to update the cached query data."

### 4.3 — Report generation (Phase 4c)

The PDF/XLSX generation is **all backend work**. Frontend just triggers the download.

But there's one subtlety: `GET /report.pdf` might take 10+ seconds. The browser will show a "loading" state on the tab but no progress indication. UX-wise, you want:

1. Click "Export PDF"
2. Show toast "Generating your report..." with a spinner
3. Send request
4. When response arrives, browser triggers download automatically (via `Content-Disposition: attachment` header on the response, which backend sets)
5. Hide toast, show "Download started" success toast

**Tell CLI Claude:**
> "Implement the report download UX. Use `window.location.href = backend_url` or `<a download>` link. Show a toast during generation. Note: the actual file save is browser-controlled — we can't track download progress directly. Just show a 'generating' state until the request completes."

---

## Phase 5 — Going live (deployment to production backend)

When everything is integrated against dev backend, switching to production is one config change:

```
# .env.production
VITE_API_BASE_URL=https://api.privact.eu
VITE_KEYCLOAK_URL=https://keycloak.privact.eu
VITE_USE_MSW=false
```

Push to GitHub → Vercel auto-deploys → production frontend now talks to production backend.

**Before going live, also:**
1. Run `npm run build` locally and check for TypeScript or build errors
2. Visit the preview URL and click through every screen — they all work?
3. Open browser DevTools → Network tab → check all requests go to the right origin
4. Check the Vercel deployment logs for any build warnings

---

## What you (and the backend dev) DON'T need to do

Things that sound like backend integration but aren't:

- **Don't compute risk on the frontend.** It's tempting to validate by computing locally, but if backend returns 60 and you'd computed 58, the user sees confusion. Backend is source of truth.
- **Don't store project data locally beyond TanStack Query cache.** No localStorage of projects, no IndexedDB. Server is the database.
- **Don't implement retry logic for normal requests.** TanStack Query handles retries. Only customize if specific endpoints need it.
- **Don't validate the same business rules in two places.** Backend validates the ROLFP grid is 0-4. Frontend can give user-friendly hints but doesn't enforce; backend's 400 response is the truth.
- **Don't implement i18n by yourself.** When consortium decides on language requirements, we'll plug in `react-i18next`.

---

## A note on the engine logic

You asked specifically about "do I need to compute risk myself?". **No.** The engine logic lives entirely in the backend. The frontend's job is:

1. Send user inputs (assets, ROLFP grids, mitigation selections) to backend.
2. Receive computed results (applicable threats, triplets, risk scores, residual risks).
3. **Display** results, don't compute them.

The reason: the engine is the "secret sauce" of PRIVACT — its applicability matrices, threat catalogs, scoring formulas. Putting it on frontend would (a) expose it in JavaScript anyone can read, (b) make it hard to update without redeploying frontend, (c) make every user re-compute on every page load.

The only "computation" frontend does:
- **Display formatting** of numbers (e.g. round to 2 decimals)
- **Aggregate sums** for KPI cards if backend doesn't pre-aggregate (e.g. counting high-risk triplets in a filtered list)
- **Optimistic UI predictions** (e.g. "if user toggles this control with reduction 0.8, the new risk is approximately X" — but backend's response is authoritative)

---

## Glossary for talking to backend dev

When you discuss integration, these are terms you'll use:

- **Endpoint**: a URL the backend exposes (`GET /api/v1/projects`)
- **Schema / contract**: the agreed shape of request and response data
- **CORS**: the browser security feature that blocks frontend from calling a different-origin backend unless backend whitelists it
- **JWT**: the JSON Web Token Keycloak gives you; frontend sends it in Authorization header
- **OIDC**: the auth protocol Keycloak uses (OpenID Connect)
- **Bearer token**: the format `Authorization: Bearer <jwt>`
- **Idempotent**: a request that can be safely retried (GET, PUT, DELETE)
- **Optimistic update**: frontend updates UI before server confirms
- **Polling**: frontend repeatedly asks "is it done yet?" — used for async jobs
- **Webhook / push**: backend tells frontend something changed — we're NOT using these (would require WebSockets, which we explicitly decided against)

---

## Integration progress checklist

Update this as endpoints get integrated. Use ✅ for done, 🟡 for in progress, ⬜ for not started.

### Auth
- ⬜ `GET /me` — current user
- ⬜ Keycloak OIDC flow
- ⬜ Token refresh
- ⬜ Logout

### Catalogs (all read-only)
- ⬜ `GET /catalog/asset-categories`
- ⬜ `GET /catalog/threats`
- ⬜ `GET /catalog/threats/{tid}`
- ⬜ `GET /catalog/vulnerabilities`
- ⬜ `GET /catalog/vulnerabilities/{vid}`
- ⬜ `GET /catalog/controls`
- ⬜ `GET /catalog/countermeasures`
- ⬜ `GET /catalog/scales`

### Projects
- ⬜ `GET /projects`
- ⬜ `POST /projects`
- ⬜ `GET /projects/{id}`
- ⬜ `PATCH /projects/{id}`
- ⬜ `DELETE /projects/{id}`
- ⬜ `POST /projects/{id}/finalize`

### Assets
- ⬜ `GET /projects/{id}/assets`
- ⬜ `POST /projects/{id}/assets`
- ⬜ `PATCH /projects/{id}/assets/{aid}`
- ⬜ `DELETE /projects/{id}/assets/{aid}`

### Engine output
- ⬜ `GET /projects/{id}/applicable-threats`
- ⬜ `GET /projects/{id}/applicable-vulnerabilities`
- ⬜ `POST /projects/{id}/compute`
- ⬜ `GET /projects/{id}/triplets` (paginated)
- ⬜ `GET /projects/{id}/triplets/{tid}`
- ⬜ `GET /projects/{id}/risk-summary`
- ⬜ `GET /projects/{id}/risk-heatmap`

### Mitigations
- ⬜ `GET /projects/{id}/triplets/{tid}/mitigations`
- ⬜ `PATCH /projects/{id}/triplets/{tid}/mitigations`
- ⬜ `PATCH /projects/{id}/mitigations/bulk`

### Output
- ⬜ `GET /projects/{id}/requirements`
- ⬜ `GET /projects/{id}/report.pdf`
- ⬜ `GET /projects/{id}/report.xlsx`
- ⬜ `GET /projects/{id}/report.json`

---

## When things go wrong

Common integration bugs and what they mean:

| Symptom | Likely cause | Action |
|---|---|---|
| 404 from real backend | Wrong path or backend doesn't have endpoint yet | Confirm endpoint URL with backend dev |
| 401 on every request | Auth token missing/expired/wrong format | Check Authorization header in Network tab |
| CORS error in console | Backend not whitelisting frontend origin | Backend dev adds `Access-Control-Allow-Origin` |
| Empty response but no error | Backend returns 200 but unexpected shape | Compare actual response to your TypeScript type |
| Works in MSW, fails on real | Schema drift between mock and reality | Update MSW to match reality, then fix frontend |
| Slow (>5s) on every call | Backend not optimized OR too much data | Pagination, caching, or backend optimization |
| Works once, fails on refresh | Auth state not persisting | Check Keycloak token storage |

When you hit one, paste the exact error to CLI Claude:
> "I'm getting `<exact error message>` when I call `<endpoint>`. The request looks like `<paste request from Network tab>`. The response is `<paste response>`. Backend dev says the endpoint should work. What's wrong?"

CLI Claude can read your code, see the request, and usually identify the mismatch in seconds.