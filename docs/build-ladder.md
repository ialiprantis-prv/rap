# Build Ladder

---

## Current state

C0, C0.1, C1 (a+b), C2, C3a, C3b, C3c, C4a, and C4b are committed and pushed (origin/main, ialiprantis-prv/rap).

C0: the rap/ monorepo is scaffolded with npm workspaces; the shared engine kernel is ported
verbatim from v3 (risk derivation, severity = round(CVSS/2), residual severity-only,
probability + zone suggestion, impact, deriveTriplets) with v3 parity tests. Backend and
frontend are stubbed.

C0.1: this clean V4 doc set and a frozen v3 archive reference.

C1 (complete): the engine-pure cascading layer. C1a adds the RAW pass — flat DependencyEdge
graph, per-CIA tau (TAU_DEFAULTS + EDGE_TYPES), DFS max-product propagation (per-traversal
visited-set, cycle-safe, no length cap), winning contributing path, Total_d = min(80,
max(individual, cascading)) as exact floats; raw source risk from in-scope triplets; §8.6 = 24.
C1b adds the residual pass — residualSourceRiskFromTriplets (via kernel residualTripletRisk)
plus the cascadeFromTriplets one-call helper.

C2 (complete): backend bootstrap. Fastify importing @rap/engine; SQLite via Drizzle +
better-sqlite3 behind a repository layer (Postgres swaps in via DATABASE_URL); Assessment CRUD
with org_id on every row; Zod validation; env config; esbuild single-file bundle (engine
inlined) with tsx dev; drizzle-kit migrations applied at startup. Endpoints open; C3 locks them.

C3a (complete): authN substrate. users/sessions/api_keys tables (org_id on every row, sessions
FK-cascade); scrypt password hashing (PHC-style, timing-safe, no native module) and SHA-256
API-key hashing (rap_<keyId>_<secret>, constant-time compare); server-side sessions in a signed
httpOnly cookie (SameSite=Lax, Secure-in-prod, absolute 8h + idle 1h), role/disable resolved live
per request; POST /login (generic 401, no enumeration) / POST /logout / GET /me / POST /me/password;
fail-closed first-boot PRV super-admin seed. Endpoints remain open — C3b adds enforcement.

C3b (complete): authorization. Declarative per-route policy (config.public / config.requiredRole)
enforced by one global preHandler guard, DENY-BY-DEFAULT (an untagged route is refused). Four roles
ranked viewer<analyst<org_admin<prv_super_admin; requiredRole is a minimum. X-API-Key auth path
(constant-time) resolving to a role-scoped principal; admin-only API-key issue/list/revoke (hex keyId).
User admin (create/list/patch/reset-password) guarded by canAssign (granted role <= actor) and canActOn
(target's current rank <= actor) so a lower-ranked admin cannot demote, disable, or reset a higher-ranked
user — the PRV super-admin is protected. Global must_change_password gating; per-account login lockout
with exponential backoff. Migration 0002 additive (api_keys.role, users.failed_attempts/locked_until).
Hardening (committed): 409 on duplicate username + last-enabled-prv_super_admin availability guard
(disable/demote refused with 409 when it would drop the enabled-super-admin count to zero).

C3c (complete): offline signed license verification. Ed25519 detached signature over the LITERAL
payload bytes (envelope { payload:b64url(JSON), sig:b64url }); verify-then-JSON.parse, no
canonicalization. Production public key is a compiled-in, esbuild-inlined constant — NOT
operator-overridable (no env switch) so the gate cannot be bypassed; the private key is held offline
by PRV. Fail-closed startup gate (exit 1, no bind) on missing/unreadable file, bad signature,
schema-invalid payload, or now>expiry (hard, no grace). customer is signature-bound + surfaced;
seats surfaced only (no runtime enforcement). GET /license (org_admin+) returns the verified summary
(no per-request re-verify). Dev uses a separate tsx entry with a dev-only key + committed sample;
the prod bundle (only entry esbuild builds) provably excludes the dev key. No DB migration.

C4a (complete): server-side source clients, slice 1 of 4. backend/src/sources/ holds the
VulnMatchSource (NVD=CPE) / VulnEnrichSource (CVE-keyed) interfaces with the engine staying pure; a
shared base client (injected fetchFn + clock, AbortController timeout, rolling-window rate limiter,
bounded jittered backoff honoring Retry-After, discriminated {ok|reason} results that never throw);
and the NVD CVE API 2.0 match adapter (virtualMatchString + apiKey header, paginated) yielding cveIds
plus captured CVSS (cached for C6, not consumed). The cache is global, org-scoped, identifier/CVE-keyed
(NOT per-assessment): vuln_source_match + vuln_match_edge (cascade FK) + vuln_source_cve, per-source
TTL, migration 0003 additive. Pure cacheState serves ok / stale (unreachable beats expired on a failed
attempt) / unavailable (cold+down) / disabled. Identity-driven warmAndResolve (NVD only) reads
cache-only and fetches just the expired/missing (all on force), per source independently. No public
endpoint yet, no new dependency (global fetch); tests use an injected fetchFn + fixtures + clock.

---

## V1 scope

V1 (D3.1 deliverable) includes:
- Asset import (CycloneDX 1.6 BOM, CPE-or-purl) and manual asset creation.
- Automatic vulnerability matching: NVD (CPE) and OSV (purl) are primary matchers; EPSS, KEV,
  and EUVD are CVE-keyed enrichment/cross-reference.
- Threat catalog management (MAGERIT v3, ENISA, MITRE ATT&CK for ICS active; NIST 800-30
  and BSI loaded when data files are supplied).
- Individual risk scoring per C/I/A (triplet model), residual risk.
- Cascading-risk computation over asset dependencies.
- Countermeasure recommendation (CVE -> CWE -> D3FEND) and residual-risk recomputation.
- Scope step with VEX auto-prune and analyst override.
- xBOMGuard overlay ingestion (enrichment + VEX auto-prune), file-based.
- Pentest evidence ingestion (confirmed flag + severity override), file-based.
- CTI STIX 2.1 ingestion, built on sample STIX data.
- Risk scenarios output (JSON) for Threat Hunting (CLX) and Cyber Range (ZELUS).
- TDIR handoff payload (asset criticality + risk scores + cascading paths), REST.
- Exports: JSON, PDF, XLSX, CycloneDX, OSCAL, with ReportProvenance generation stamp.
- REST API (X-API-Key for machine clients; login session for the UI).
- Built-in username/password accounts, 4 roles, server-enforced.
- Offline signed license verification (no phone-home).
- Single Docker image, SaaS and on-prem delivery from the same build.
- EPSS and KEV enrichment.

---

## V1 out-of-scope

Live REST auto-ingestion from xBOMGuard and Pentest (V1 is file-based).
Live CTI ingestion (V1 uses sample STIX; flips live when ENDO confirms the field mapping).
NIST SP 800-30 and BSI catalogs until the data files are supplied.
Multi-tenancy (V1 is single-tenant per deployment).
SSO/OIDC/Keycloak (built-in accounts only; SSO addable later).
Offline editing (offline mode is read-only).
Accumulating/probabilistic-OR cascading propagation mode (V2 candidate, UR-F7).
Strict CVSS 4.0 scoring (V1 keeps the round(CVSS/2) approximation plus manual override;
    CVSS 4.0 native scoring is a V2 item).
Anything owned by other tools: detection/monitoring/incident response (TDIR), SBOM
    generation (xBOMGuard), CTI production (PolemAIrchOS).
OSV advisories without a CVE alias (GHSA/PYSEC-only): not ingested in V1 (cache and kernel are
    CVE-keyed). Candidate for V2 non-CVE advisory support.
Full pilot production data.

---

## Spec divergences (R2-flagged, locked)

The following V4 decisions diverge from the RAP_Specification_for_Build.md and are
recorded here per the R2 standing rule.

1. Backend: Node/TypeScript, not the Python/FastAPI recommendation in spec section 9.
   Reason: TypeScript allows the backend to import the shared engine package directly,
   eliminating a second implementation. The spec permits this choice.

2. Residual risk: severity-only (v3 kernel), not the multiplicative-on-total formula in
   spec section 8.4. The spec 8.4 form is the retired v2 model and violates the kernel
   invariant. Locked in scope-lock section 12.

3. Asset intake: CPE-or-purl, not CPE-only (changes v3 C6.5). Required by xBOMGuard
   purl-first BOMs and acceptance test #1. Locked in scope-lock section 8.

4. Risk bands and probability zone dimension: carried from v3 (Low 0-8 / Medium 9-29 /
   High 30-80; Purdue/ISA-95 zone modifier on probability suggestion). The spec omitted
   these; they are restored. Locked in scope-lock section 12.

5. Architecture: backend-centric (engine server-side, authoritative), not the v3 client-
   side model. Required for partner REST integrations and TRL-7. Confirmed in spec
   Decision D-2.

---

## C0-C10 build ladder

### C0 (committed)

Scaffold rap/ npm-workspaces monorepo. Port the shared engine kernel verbatim from v3
lib/* (risk, severity = round(CVSS/2), residual severity-only, probability + zone,
impact, deriveTriplets). Write v3 parity unit tests. Stub backend and frontend packages.

### C0.1 (committed)

Write this clean V4 doc set (7 files in docs/). Archive a reference copy of the v3
docs for historical rationale. Pushed with C0.

### C1 (complete: C1a + C1b committed)

Engine-pure cascading layer in engine/. Locked decisions D1-D5:
- D1: engine consumes a flat DependencyEdge[] (from -> to); containment/parent_ref edge
  derivation is deferred to the backend. No Asset kernel-type change.
- D2: pure core propagate(edges, sourceRiskByAsset, dim) per dimension, plus methodology-aware
  reducers sourceRiskFromTriplets (raw) and residualSourceRiskFromTriplets (residual).
- D3: DFS max-product per dim, per-traversal visited-set (cycle-safe, NO length cap); effective
  tau_d = override ?? TAU_DEFAULTS[type][d]; tau_d = 0 drops the edge for d; exact floats;
  deterministic tie-break (source assetId asc, then edge order); winning path recorded.
- D4: CascadingRisk_d over upstream sources only (no self-cascade); Total_d = min(80,
  max(IndividualRisk_d, CascadingRisk_d)).
- D5: indeterminate source triplets contribute 0 to source risk; V1 does not propagate an
  indeterminate cascading state.

C1a (committed): types/cascading.ts + constants (TAU_DEFAULTS, EDGE_TYPES) + propagate/
propagateAll + sourceRiskFromTriplets (raw) + residual reducer signature stub; full invariant
suite + the §8.6 acceptance test (Edge Node -> Data Manager, tau_A=0.8 = 24).

C1b (committed): residualSourceRiskFromTriplets (source risk from residualTripletRisk) +
cascadeFromTriplets one-call helper + residual propagation tests.

### C2 (committed)

Backend bootstrap and database layer. Node/TS server, SQLite default (Postgres optional
via connection-string config). Assessment CRUD endpoints. Single-tenant schema, org_id
stamped on all records.

### C3 (complete — C3a/C3b/C3c committed)

Authentication and identity, split into three independently gate-able rungs.

C3a (committed): authN substrate. Built-in username/password accounts with scrypt hashing
(Node built-in crypto.scrypt, PHC-style, timing-safe) — chosen over bcrypt/Argon2 to avoid a
second native module and keep the air-gapped image lean. API keys issued as rap_<keyId>_<secret>
and stored SHA-256-hashed (a fast hash is correct for a 256-bit random token; constant-time
compare), revocable, never logged or exported. Server-side login session in a signed httpOnly
cookie (SameSite=Lax, Secure-in-prod, absolute 8h + idle 1h), role/disable resolved live per
request. Fail-closed first-boot PRV super-admin seed (env-provided, must_change_password).
Endpoints remain open.

C3b (committed): authorization. Declarative per-route policy enforced by a global deny-by-default
guard; four roles ranked viewer<analyst<org_admin<prv_super_admin (requiredRole = minimum); public
allowlist /health, /login, /logout. X-API-Key auth + admin-only API-key issue/list/revoke (hex keyId).
User admin guarded by canAssign + canActOn so a lower-ranked admin cannot demote/disable/reset a
higher-ranked user (PRV super-admin protected). Global must_change_password gating; per-account login
lockout (exponential backoff). Flips the system open -> locked. Hardening (committed): 409 on
duplicate username; last-enabled-prv_super_admin availability guard (disable/demote that would
remove the final enabled super-admin is refused with 409).

C3c (committed): offline signed license verification at startup. Five locked decisions:
- Signature: Ed25519 via Node crypto (no native dependency).
- File format: a detached signature over the LITERAL license-JSON bytes. Envelope
  { payload: base64url(<exact license-JSON bytes>), sig: base64url(<Ed25519 over those bytes>) }.
  Verification decodes payload, Ed25519-verifies the signature over those exact bytes, THEN
  JSON.parse — no canonicalization.
- Payload (Zod): { v:1, licenseId, customer, issuedAt (ISO-8601), expiry (ISO-8601 UTC), seats:int }.
  expiry is hard (no grace). customer is signature-bound + surfaced (not separately enforced); seats
  is recorded/surfaced only — NO runtime enforcement.
- Fail-closed: the process exits non-zero and never binds on missing/unreadable file, bad signature,
  malformed/schema-invalid payload, or now > expiry. One clear log line (identity/expiry when
  parseable, no secrets). GET /license (org_admin+) returns the startup-verified summary; it does
  not re-verify per request.
- Key handling: the production Ed25519 public key is a compiled-in source constant (esbuild-inlined),
  NOT operator-overridable — there is deliberately no env switch for the verification key, so the
  gate cannot be bypassed. The production private key is held offline by PRV. Dev/test run a SEPARATE
  tsx entrypoint that injects a dev-only key (committed under backend/dev/) and a committed sample
  license; esbuild bundles only the prod entry, so the dev key is provably absent from the prod
  bundle. No DB migration (the license is file-verified and held in app state).

### C4 (in progress — C4a committed)

Server-side source clients, sliced C4a-C4d. Locked pre-screen decisions D1-D7:
- D1: four slices; offline degradation baked into the cache from C4a, not a tail feature.
- D2: two interfaces in backend/src/sources/, engine stays pure — VulnMatchSource (NVD=CPE,
  OSV=purl) and VulnEnrichSource (CVE-keyed: EPSS, KEV, EUVD). EUVD is a CVE-keyed cross-reference,
  NOT a primary matcher (its API has no CPE/purl parameter; vendor/product discovery is V2).
- D3: global, org-scoped, identifier/CVE-keyed cache (NOT per-assessment). Three tables:
  vuln_source_match + vuln_match_edge ((identity)<->(cve), cascade FK) + vuln_source_cve. Per-source
  TTL via expires_at = fetched_at + ttl. Behind the repo layer (SQLite default, Postgres-swappable).
- D4: reads are cache-only (only refresh touches the network); serve stale, never withhold; per-source
  states ok / stale (reason expired|unreachable; unreachable wins on a failed attempt) / unavailable
  (cold + source down) / disabled; per-source independence.
- D5: only NVD_API_KEY is a secret (server-side). Per-source enable flags + master RAP_SOURCES_OFFLINE.
  Per-source rate limiter + bounded backoff honoring Retry-After.
- D6: refresh is an async job — POST /assessments/{id}/vulns:refresh -> 202 + jobId;
  GET /assessments/{id}/vulns:refresh/{jobId} polls; vuln_refresh_job table + in-process worker; one
  in-flight job per assessment. The job always completes with a per-source report (total outage = done
  with all-unavailable, not error).
- D7: no live network in tests — injected fetchFn + committed fixtures + injected clock.

C4a (committed): source interfaces + shared base client + NVD match adapter + the three cache tables
(migration 0003, additive) + cache repo + identity-driven warmAndResolve wired to NVD only. No public
endpoint yet (the async endpoint is built once in C4d). NVD CVSS is captured into the cache but not
consumed (severity = round(CVSS/2) is C6).

C4b (committed): OSV adapter (identityKind purl) querying /v1/query once per identity (NOT
querybatch); CVE taken from record.aliases (one edge per CVE; non-CVE OSV records dropped);
version-bearing cache key (canonicalIdentityValue); resolve fans out NVD + OSV, union deduped
by CVE.
C4c: EPSS + KEV + EUVD enrichment adapters -> vuln_source_cve; enrichment join into the resolved view.
C4d: vuln_refresh_job (migration 0004) + worker + async POST/GET endpoints (route policy,
deny-by-default) + full fan-out + offline/partial-failure hardening + tests.

### C5

Importers. CycloneDX 1.6 BOM import (CPE-or-purl, one asset per component).
xBOMGuard overlay import (enrichment + VEX auto-prune to scope step, reason shown).
Pentest evidence import (confirmed flag + severity override + provenance storage).
CTI STIX 2.1 ingestion on sample data, threat catalog merge.

### C6

Scope step and individual risk over the API. Scope persistence (in/out per triplet, with
reason). Analyst manual prune/restore and VEX override. Individual risk computation
server-side (engine call). Residual risk computation. Override persistence with provenance
(source, default-or-overridden, timestamp). Server authoritative: all risk reads go through
the API.

### C7

Dependencies and Cascading frontend screen. Graph editor: view and add/edit dependency
edges, set edge type and tau per CIA. Display propagated CascadingRisk_d, Total_d, and
contributing paths per asset. Re-compute trigger on tau change. Cascading results echoed
in Dashboard and Export screens.

### C8

Frontend rewire to the real API. Seed frontend/ from risk-frontend. Replace all MSW
handler calls with TanStack Query calls to the real backend endpoints. Add login screen
(username/password). Role-aware UI: hide actions the current role cannot perform (server
enforcement is the gate). Remove MSW from the production build (retain for dev/test).

### C9

Exporters and outputs. JSON export (full assessment + overrides + cascading paths).
PDF export. XLSX export. CycloneDX export (assets + vulnerabilities, VDR/VEX optional).
OSCAL export. All exports include ReportProvenance with version, build SHA, and timestamp.
Risk scenarios endpoint and JSON output (asset, threat, ATT&CK technique where known,
severity/band, CVE, cascading paths). TDIR handoff endpoint.

### C10

Docker packaging. Single-image Dockerfile (Ubuntu base): builds frontend, compiles
backend and engine, serves both from one container. SaaS and on-prem from the same image
(config-driven). Build SHA stamped into the image label, the running application, and
all exports. Offline signed license verification wired (C3 logic) and confirmed in the
container startup sequence. Private registry push + offline image file (`docker save`)
for air-gapped delivery. Semantic version tag applied.
