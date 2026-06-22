# PRIVACT Risk Assessment Platform (RAP) — V4

Tool: T3.4-PRV-RAP  
Project: AENAON (GA 101249723)  
Service: Threat and Risk Assessment (TRA), GA Objective 5  
TRL: 7  
Owner: PRIVACT (PRV)

---

## What V4 is

V4 evolves the v3 client-side PRIVACT risk tool into a containerised product: a small
Node/TypeScript backend holds the authoritative engine, a shared TypeScript engine package
carries the PRIVACT methodology kernel (ported verbatim from v3 plus the new cascading layer),
and the existing React frontend is rewired to the real API. The result is a single Docker
image, deployable you-hosted (SaaS) or customer on-prem, that exposes a REST API for partner
integrations and computes both individual and cascading (propagated) risk per the Grant
Agreement.

The PRIVACT methodology kernel is **invariant** from v3. Nothing in the formula, scales,
bands, ROLFP model, or phase sequence changes in V4.

---

## Current state

- C0 (committed): rap/ monorepo scaffolded; shared engine kernel ported from v3 with parity tests.
- C0.1 (in progress): this clean V4 doc set written; frozen v3 archive referenced for history.
- C1 onward: see `build-ladder.md`.

---

## Document index

| File | Contents |
|---|---|
| methodology-kernel.md | The invariant PRIVACT risk formula, scales, bands, ROLFP, residual model, phases |
| cascading-risk.md | The V4 cascading (propagated) risk layer — additive, does not change the triplet formula |
| architecture.md | Engine, backend, frontend, source clients, DB, offline model, identity, distribution |
| integrations.md | Partner integrations, correlation identifiers, REST API surface, threat catalogs |
| working-agreement.md | Collaboration conventions, roles, Gate 4.5, standing rules |
| build-ladder.md | V1 scope, V1 out-of-scope, spec divergences, C0-C10 build ladder |

---

## Monorepo layout

```
rap/
  engine/       Shared TypeScript methodology package (individual risk, cascading, residual)
  backend/      Node/TypeScript API server (DB, auth, source clients, REST endpoints)
  frontend/     React 19 + Mantine v9 SPA, seeded from risk-frontend, rewired to the API
  docker/       Dockerfile, compose files, entrypoints
  docs/         This documentation set
```

npm workspaces; `tsconfig.base.json` + per-package project references.

---

## Quick start

```
npm install                  # install all workspace dependencies from repo root

# Engine (pure functions, no runtime deps)
npm run test -w engine       # run parity + cascading acceptance tests

# Backend
npm run dev -w backend       # start API on :3001 (requires DB_PATH env)

# Frontend
npm run dev -w frontend      # start Vite dev server on :5173 (VITE_API_URL=http://localhost:3001)

# Docker
docker build -f docker/Dockerfile -t rap:dev .
docker run -p 3000:3000 rap:dev
```

For local frontend development without the backend, the frontend package retains MSW
(mock service worker) for dev and test only; it is not present in the production build.
