# Architecture

---

## Design principle: evolve, not rebuild

V4 is an evolution of the v3 React/TypeScript risk-frontend. The PRIVACT methodology kernel
is ported verbatim from v3 lib/ files into the shared engine package. The frontend is seeded
from the v3 source and rewired to the real API. Nothing is rebuilt from scratch.

---

## Engine (shared TypeScript package)

Path: `engine/`

The engine is the single source of truth for all methodology computation. It runs
server-side (authoritative for the API) and is importable by the browser-side code. Having
one implementation prevents formula drift between the API and the UI.

The engine contains: impact derivation, severity derivation, individual risk per triplet
per CIA dimension, max-risk, residual risk (severity-only, strongest D3FEND delta), probability
suggestion (baseline + zone modifier), phase-status derivation, and the cascading risk
propagation layer (graph build, max-path propagation, Total_d, contributing paths).

The engine has no runtime dependencies on the backend or the browser. It is tested with
unit tests covering v3 parity vectors and the cascading acceptance test (see
`cascading-risk.md` worked example).

---

## Backend (Node/TypeScript API server)

Path: `backend/`

Technology: Node.js, TypeScript. Not Python; the spec recommendation of Python/FastAPI is
overridden because TypeScript allows the backend to share the engine package directly with
no second implementation.

Responsibilities:
- Hosts the authoritative REST API (see `integrations.md` for the endpoint surface).
- Imports the engine package and calls it server-side for all risk and cascading computation.
- Manages the database (assessment CRUD, asset/threat/vulnerability/edge/override records,
  vulnerability cache, user accounts, API keys).
- Runs all server-side source queries (NVD, EUVD, OSV, EPSS, KEV/CSAF) so that API keys
  stay server-side and CORS is not an issue.
- Serves exports (JSON, PDF, XLSX, CycloneDX, OSCAL) via the API.

---

## Frontend (React SPA)

Path: `frontend/`

Technology: React 19, TypeScript, Mantine v9, TanStack Query and Table, React Router 7,
React Hook Form, Zod. Seeded from the v3 risk-frontend source.

The frontend is rewired to the real API. MSW (Mock Service Worker) is retained for local
development and frontend tests only; it is not included in the production build.

All v3 phase screens are kept (Setup, Assets, Review, Scope, Triplets, Mitigations,
Dashboard, Export, Catalog). V4 adds the "Dependencies and Cascading" screen after
Mitigations. Cascading results are also echoed in the Dashboard and in exports.

The engine is server-side and authoritative. When official sources are unreachable, the
browser shows a read-only last-state snapshot labelled "offline, as-of [date]". Offline
mode is view-only; the browser cannot recompute risk without the server.

---

## Server-side source clients

All vulnerability source queries run in the backend. Sources for V1:

- NVD CVE API 2.0 (CPE-based; NVD API key optional, held server-side, raises rate limit).
- EUVD (ENISA European Vulnerability Database).
- OSV.dev (purl-based).
- CISA KEV / CSAF (known-exploited flag).
- EPSS (exploit prediction score, enrichment).

When a source is unreachable, the system serves the last cached result for that asset/CVE
and marks it stale with a timestamp. Clear indicators are shown in the UI and in exports.

Air-gapped deployments: the server runs locally; seed data is loaded at setup time. Export
and re-import of an assessment reproduces identical scores anywhere.

---

## Vulnerability cache

The server database holds a vulnerability cache keyed by (CPE or purl) and CVE, with a
TTL and a last-fetched timestamp. The cache is the offline fallback. When the TTL expires
the server re-queries on the next vulnerability-refresh call. Stale entries are served
with a `stale_as_of` field rather than being withheld.

---

## Database and storage

Default store: SQLite (file-based, no external service required, suitable for single-tenant
on-prem and the D3.1 demo).
Optional: PostgreSQL, behind a DB abstraction layer. Switching between SQLite and Postgres
requires only a connection-string configuration change.

Single-tenant per deployment: one database instance serves one customer organisation.
The database stamps every record with an `org_id` field to support a possible future
multi-tenant migration without a schema change.

---

## Identity and access

### Three distinct keys

1. License key: grants the right to run the software. Verified locally; no phone-home.
2. API key: machine-to-API authentication (partners, automated pipelines). X-API-Key header.
3. User login: human-to-UI authentication (username/password session).

These are distinct credentials with distinct scopes. An API key does not grant UI access;
a user session does not substitute for an API key on machine calls.

### User accounts

Built-in username/password accounts, self-contained (air-gapped-friendly). SSO/OIDC can
be added later without architectural changes.

### API keys

One API key per consumer (partner tool or internal service). Revocable individually.
Stored hashed server-side. Never logged, never included in exports. The browser UI uses
the user's login session cookie, never a static API key.

### Roles (four)

| Role | Description |
|---|---|
| PRV super-admin | Full control including license management and user admin. Held by PRV only; customers do not receive this role. |
| org-admin | Manages the organisation's users and settings. |
| analyst | Creates assessments, imports assets, runs vulnerability refresh, applies overrides, runs exports. |
| viewer/auditor | Read-only access to all assessment data and exports. |

Role restrictions are enforced server-side on every API call. The UI adapts to hide
actions the current role cannot perform, but server enforcement is the authoritative gate.

---

## Distribution and operations

### Docker image

One Docker image, two delivery modes from the same build:
- You-hosted (SaaS): PRV operates the image; default for the D3.1 demo.
- Customer on-prem: the customer receives and runs the image in their own environment.

The image serves the Node API and the compiled React SPA from a single container.
Base OS: Ubuntu. The image is proprietary and closed-source; PRV ships the built image,
not the source code.

### License

An offline signed license file specifies customer identity, expiry date, and seat count.
The server verifies the license at startup using a local public key; there is no phone-home.
Deployments without a valid license file do not start.

### Delivery channels

- Private registry: PRV-issued pull credentials.
- Offline image file: `docker save` output for air-gapped environments.

### Versioning

Semantic version tags (e.g. 1.0.0) plus immutable image tags plus a build SHA.
The build SHA is stamped into the running application and into all exports in the
`ReportProvenance` field, enabling unambiguous traceability of which engine version
produced a given assessment.
