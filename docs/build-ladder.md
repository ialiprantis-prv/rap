# Build Ladder

---

## Current state

C0, C0.1, and C1a are committed and pushed (origin/main, ialiprantis-prv/rap).

C0: the rap/ monorepo is scaffolded with npm workspaces; the shared engine kernel is ported
verbatim from v3 (risk derivation, severity = round(CVSS/2), residual severity-only,
probability + zone suggestion, impact, deriveTriplets) with v3 parity tests. Backend and
frontend are stubbed.

C0.1: this clean V4 doc set and a frozen v3 archive reference.

C1 is spec-locked and split. C1a (committed) adds the engine-pure cascading RAW pass: flat
DependencyEdge graph, per-CIA tau (TAU_DEFAULTS + EDGE_TYPES), DFS max-product propagation
(per-traversal visited-set, cycle-safe, no length cap), winning contributing path, and
Total_d = min(80, max(individual, cascading)) as exact floats; raw source risk from in-scope
triplets; the §8.6 worked example passes (=24). C1b (next) adds the residual pass.

---

## V1 scope

V1 (D3.1 deliverable) includes:
- Asset import (CycloneDX 1.6 BOM, CPE-or-purl) and manual asset creation.
- Automatic vulnerability matching against NVD, EUVD, OSV, EPSS, KEV.
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

### C1 (split: C1a committed, C1b next)

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

C1b (next): residualSourceRiskFromTriplets behaviour (source risk from residualTripletRisk) +
residual propagation pass + tests.

### C2

Backend bootstrap and database layer. Node/TS server, SQLite default (Postgres optional
via connection-string config). Assessment CRUD endpoints. Single-tenant schema, org_id
stamped on all records.

### C3

Authentication. API keys: generated, hashed (bcrypt or Argon2), stored server-side,
revocable, never logged or exported. Built-in username/password accounts, bcrypt passwords.
Login session (httpOnly cookie). Four roles enforced server-side on every API call.
Offline signed license file verification at startup (public key embedded in the image).

### C4

Server-side source clients. NVD CVE API 2.0 (keyless default; NVD_API_KEY env secret).
EUVD. OSV.dev. EPSS. CISA KEV/CSAF. DB vulnerability cache with TTL and last-fetched
timestamp. Offline degradation: serve last cached result marked stale-as-of when a
source is unreachable. Vulnerability refresh endpoint (`POST /assessments/{id}/vulns:refresh`).

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
