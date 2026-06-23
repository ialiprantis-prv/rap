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
- Branch main. Remote: ialiprantis-prv/rap (private). C0 + C0.1 pushed (origin/main).
- C0 DONE (committed): scaffold monorepo + engine kernel ported verbatim from v3; parity tests
  green. Severity = round(CVSS/2) (v3 C4 live rule).
- C0.1 DONE (committed): clean V4 docs + frozen v3 archive + this CLAUDE.md.
- NEXT: C1 — engine cascading layer. SPEC-LOCKED (pending build), decisions:
  1. Engine consumes a flat unified DependencyEdge[]; containment-edge derivation deferred to
     the backend (engine stays graph-pure; no Asset kernel-type change).
  2. API: pure core propagate(edges, sourceRiskByAsset, dim) + triplet-ingesting reducers
     (sourceRiskFromTriplets raw / residualSourceRiskFromTriplets via residualTripletRisk) so
     source-risk reduction stays engine methodology.
  3. Algorithm: DFS max-product per dim, per-traversal visited-set (cycle-safe, no length cap),
     winning path recorded (doc-sanctioned "or DFS").
  4. CascadingRisk_d / Total_d are exact floats (no engine rounding); display rounding is FE.
  - TAU_DEFAULTS + EDGE_TYPES in engine/constants.ts; effective tau_d = override_d ??
    default; tau_d=0 drops the edge for d; deterministic tie-break (source assetId asc, then
    edge order). §8.6 (Edge Node -> Data Manager = 24) is the acceptance test.
  See docs/cascading-risk.md + docs/build-ladder.md §C1.

## Quick start
- npm install at repo root (workspaces). engine/: npm run build / npm test.
- engine/ carries zero methodology drift from v3 — parity tests lock it.
