# PRIVACT RAP — Risk Assessment Platform (V4)

## Project identity
- AENAON tool T3.4-PRV-RAP. EU project AENAON, GA 101249723. Service: Threat & Risk
  Assessment (TRA, GA Objective 5). TRL 7.
- An EVOLVE of the v3 React/TS risk-frontend into a containerised product: shared TS engine +
  Node/TS backend + React frontend, single Docker image, proprietary/closed-source, PRV always admin.
- This repo (~/projects/rap) is a monorepo (npm workspaces): engine/, backend/, frontend/, docker/, docs/.
- The v3 repo risk-frontend is RETIRED and not part of this project. Its rationale is frozen in
  docs/archive/v3-reference/. Do not work in risk-frontend.

## Read first (docs/)
1. docs/methodology-kernel.md — the INVARIANT scoring kernel. Never drifts.
2. docs/cascading-risk.md — the NEW V4 cascading layer.
3. docs/architecture.md — engine/backend/frontend, sources, DB, identity, distribution.
4. docs/integrations.md — partner I/O (xBOMGuard, pentest, CTI, TDIR), CPE-or-purl, scope, API.
5. docs/working-agreement.md — collaboration model (summary below).
6. docs/build-ladder.md — the C0–C10 plan, current state, V1 scope/out, divergences.
Authoritative source docs in docs/source/ (scope-lock, spec, integration matrix, workbook).

## Working model (two-tool)
- Chat strategist specs + audits; Claude Code CLI builds in the terminal; human relays + approves.
- PROPOSE-DON'T-APPLY: no repo edit/commit/push without explicit per-action approval.
- English; no emojis.
- R1 context budget: flag early; finish the current safe unit, then hand off before drift.
- R2 divergence disclosure: flag anything conflicting with the core docs, by name, up front.
  Methodology preservation is non-negotiable.
- Pre-screen spec-lock before any build (3–5 decisions, one question at a time).
- Gate 4.5 (full-stack) before any commit: engine/backend/frontend tsc + eslint + tests + build;
  backend API smoke; frontend dev-boot smoke; Docker build. Stop at the gate; commit only on approval.
- Atomic commits, frequent push. File caps 220 soft / 260 hard.

## Methodology kernel — INVARIANT (detail in docs/methodology-kernel.md)
- Per CIA dim d: Risk_d = Impact_d × ThreatApplicability_d(threat-CIA-only) × Probability × Severity.
- Impact_d = max over 5 ROLFP rows (0–4). Probability 0–4 = override ?? (baseline 2 + Purdue zone
  modifier), per threat×assetType×zone. Severity 0–5 = override ?? round(CVSS/2) clamped 0–5;
  undefined ⇒ INDETERMINATE (not 0).
- Max Risk = max(C,I,A), 0–80. Bands: Low 0–8 / Medium 9–29 / High 30–80.
- Residual = severity-only: residualSev = remediated?0:max(0, sev − strongest D3FEND tactic delta)
  [Isolate −3/Harden −2/Deceive·Detect −1/Evict·Restore·Model 0; override [−5,0]]; strongest single, no stacking.
- NEW cascading (additive; does NOT change the triplet formula): τ-weighted max-path over the
  dependency graph; Total_d = min(80, max(Individual, Cascading)); raw + residual; contributing
  paths recorded; out-of-scope triplets don't propagate.
- Triplet id: TR-{projectId}-{assetId}-{threatId}-{cveId}. Phases: Setup→Assets→Review→Triplets→
  Mitigations→Dashboard→Export (+ new Dependencies & Cascading screen).

## Current state
- Branch main. Remote: ialiprantis-prv/rap (private). origin/main = e6c85f2.
- C0 DONE (committed): scaffold monorepo + engine kernel ported verbatim from v3; parity tests
  green. Severity = round(CVSS/2) (v3 C4 live rule).
- C0.1 DONE (committed): clean V4 docs + frozen v3 archive + this CLAUDE.md.
- C1 DONE (committed): engine cascading layer COMPLETE.
  - C1a: raw — propagate/propagateAll/sourceRiskFromTriplets; DFS max-product per CIA;
    per-traversal visited-set (cycle-safe, no length cap); winning path; exact floats;
    §8.6 Edge Node -> Data Manager = 24 acceptance test green.
  - C1b: residual — residualSourceRiskFromTriplets (source risk via kernel residualTripletRisk)
    + cascadeFromTriplets one-call helper.
- C2 DONE (committed): backend bootstrap. Fastify importing @rap/engine; SQLite via Drizzle +
  better-sqlite3 behind a repository layer (Postgres-swappable via DATABASE_URL); Assessment CRUD
  with org_id on every row; Zod at boundaries; env config; esbuild single-file bundle (engine
  inlined) + tsx dev; drizzle-kit migrations applied at startup. Gate 4.5 step 4 (backend API
  smoke, Fastify inject) is LIVE. Endpoints OPEN — locked down in C3.
- NEXT: C3 — authentication + identity (NOT yet spec-locked; pre-screen pending). Scope per
  build-ladder §C3: API keys (hashed, revocable, never logged/exported); built-in username/
  password accounts; login session (httpOnly cookie); four roles enforced server-side on every
  call; offline signed license verification at startup. See build-ladder.md §C3 + architecture.md.

## Quick start
- npm install at repo root (workspaces). engine/: npm run build / npm test.
- engine/ carries zero methodology drift from v3 — parity tests lock it.
