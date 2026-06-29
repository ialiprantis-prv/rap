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
- Branch main. Remote: ialiprantis-prv/rap (private). origin/main = d5ad8ea.
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
- C3 DONE (committed): authentication + identity, sliced C3a/C3b/C3c.
  - C3a DONE (committed): authN substrate. users/sessions/api_keys tables (org_id on every row,
    sessions FK-cascade); scrypt password hashing (PHC-style, timing-safe, no native module) +
    SHA-256 API-key hashing (rap_<keyId>_<secret>, constant-time); server-side sessions in a signed
    httpOnly cookie (SameSite=Lax, Secure-in-prod, absolute 8h + idle 1h), role/disable resolved
    live per request; POST /login (generic 401, no enumeration), POST /logout, GET /me,
    POST /me/password; fail-closed first-boot PRV super-admin seed. Endpoints OPEN — gated in C3b.
  - C3b DONE (committed): authorization. Declarative per-route policy + one global guard,
    DENY-BY-DEFAULT (untagged route refused); four roles ranked
    viewer<analyst<org_admin<prv_super_admin enforced on every route (public allowlist: /health,
    /login, /logout); X-API-Key
    auth (constant-time) + admin-only API-key issue/list/revoke (hex keyId); user admin guarded by
    canAssign + canActOn so a lower-ranked admin cannot demote/disable/reset a higher-ranked user
    (PRV super-admin protected); global must_change_password gating; per-account login lockout
    (exponential backoff). Migration 0002 additive. Hardening (committed): 409 on duplicate username
    + last-enabled-prv_super_admin availability guard.
  - C3c DONE (committed): offline signed license verification. Ed25519 detached signature over the
    LITERAL payload bytes (envelope { payload:b64url(JSON), sig:b64url }); verify-then-JSON.parse,
    no canonicalization. Prod public key is a compiled-in, esbuild-inlined constant — NOT
    operator-overridable (no env switch, no bypass); prod private key held offline by PRV. Startup
    gate is fail-closed (exit 1, no bind) on missing/unreadable file, bad signature, schema-invalid
    payload, or now>expiry (hard, no grace). customer signature-bound + surfaced; seats surfaced
    only (no runtime enforcement). GET /license (org_admin+) returns the verified summary (no
    re-verify). Dev: separate tsx entry (src/dev/index.ts) injects a dev-only key from backend/dev/
    + committed sample license; esbuild bundles only the prod entry so the dev key is provably
    absent from the prod bundle. No DB migration.
- C4 IN PROGRESS — server-side source clients, sliced C4a/C4b/C4c/C4d (build-ladder §C4).
  - C4a DONE (committed): source interfaces + vuln cache + NVD match client + resolve service.
    backend/src/sources/: VulnMatchSource (NVD=CPE) / VulnEnrichSource (CVE-keyed: EPSS/KEV/EUVD,
    later slices) split; shared base client (injected fetchFn + now clock; AbortController timeout;
    bounded jittered backoff honoring Retry-After; per-source rolling-window limiter; discriminated
    {ok|reason} results, never throws). NVD CVE API 2.0 adapter (virtualMatchString/cpeName + apiKey
    header, paginated) -> cveIds + captured CVSS (NOT consumed; severity is C6). Cache is global,
    org-scoped, identifier/CVE-keyed (NOT per-assessment): three tables vuln_source_match /
    vuln_match_edge (cascade FK) / vuln_source_cve; per-source TTL (expires_at = fetched_at + ttl);
    migration 0003 additive. Pure cacheState -> ok / stale (unreachable beats expired on a failed
    attempt) / unavailable (cold+down) / disabled. Identity-driven warmAndResolve (NVD only): reads
    cache-only, fetches only expired/missing (all on force), per-source independent, per-source status.
    Config: NVD_API_KEY (server-side only) + RAP_SOURCE_NVD_ENABLED + master RAP_SOURCES_OFFLINE +
    NVD rate/TTL knobs. No new dependency (global fetch); injected-fetch fixtured tests. EUVD
    reclassified as CVE-keyed enrichment, not a primary matcher (R2). [45e0eee]
  - C4b DONE (committed): OSV purl-match client + resolve fan-out. backend/src/sources/osv.ts:
    VulnMatchSource (identityKind 'purl') querying OSV /v1/query once per identity (full records,
    NOT querybatch); request rule version-XOR-versioned-purl. OSV ids are GHSA/PYSEC/OSV with the
    CVE in aliases -> one vuln_match_edge per CVE alias; records with no CVE alias dropped silently
    (documented V1 gap). OSV severity captured as a CVSS vector string into vuln_source_cve
    (source='osv') payload (NOT consumed; C6). New sources/normalize.ts: canonicalIdentityValue
    yields a version-bearing cache key (CPE as-is; purl -> pkg:...@version, attaching version when
    unversioned, else skip) so two versions can't collide on one row; N-2 normalizer
    (source/identity_kind lowercased + validated) applied at every cache read/write. resolve fans
    out per identity x enabled match source, union deduped by cve_id with per-source provenance,
    per-source independent. No DB migration (reuses the three C4a tables; payload $type widened to
    {cvss?,cvssVector?}). No new dependency. [d5ad8ea]
  - NEXT: C4c — EPSS + KEV + EUVD enrichment (build-ladder §C4).

## Quick start
- npm install at repo root (workspaces). engine/: npm run build / npm test.
- engine/ carries zero methodology drift from v3 — parity tests lock it.
