# PRIVACT Backend Endpoints (45 as of v2.0; 49 documented after v3 S3-A)

REST + JSON. All under `/api/v1`. Auth via Keycloak (Bearer token).
Backend mocked with MSW during frontend development. v1 ended at 35
endpoints; v2 added 10 across the 14-commit standards-alignment series
(see `docs/v2-migration-progress.md`).

> **v3 S3-A delta.** Added 4 new endpoints (`/projects/{id}/library/threats`
> CRUD) → 49 documented. Separately, three endpoints already listed below
> (`GET /catalog/threats`, `GET /catalog/threats/{tid}`, `GET /catalog/scales`)
> were in the nominal v2.0 set but had **no MSW handler**; S3-A implements them
> for real. Implemented MSW handler count: 45 → 52 (+7 = 2 catalog-threats +
> 1 scales + 4 working-set ops) → **47 after C10** (−5: the v2 triplet
> endpoints `GET /triplets`, `GET /triplets/:tid`, `GET /risk-summary`,
> `POST /compute`, `PATCH /triplets/:tid/env-override` were unregistered +
> deleted — see the "Engine output" RETIRED banner below). `GET
> /catalog/vulnerabilities` and `/{vid}` remain documented-but-unimplemented
> (out of S3-A scope).
>
> **v3 C1a delta.** +1 endpoint: `GET /catalog/asset-types` (canonical 14-value
> CycloneDX taxonomy) → 50 documented; 53 implemented MSW handlers. The legacy
> `GET /catalog/asset-categories` is kept (frozen), not renamed. Field rename
> `Asset.type` → `Asset.assetType`; `Asset.privact.legacyCategory` frozen
> transitional (v1 matrix only).

## Catalog (sourced from external libraries — see backend-integration-playbook.md §0.4)

- `GET /catalog/asset-types` — **v3 C1a (NEW).** Canonical asset-type taxonomy:
  the 13 CycloneDX 1.6 component types (`application`, `framework`, `library`,
  `container`, `platform`, `operating-system`, `device`, `device-driver`,
  `firmware`, `file`, `data`, `machine-learning-model`, `cryptographic-asset`)
  + the PRIVACT `service` pseudo-type = **14** values (`{ id, label }`). New /
  UI code uses this; `Asset.assetType` holds a `CycloneDxComponentType`.
- `GET /catalog/asset-categories` — **FROZEN LEGACY (v3 C1a).** 7 v1 slugs
  (Database, Application/API, Container, Container Network, Hardware, OS,
  TCP/IP). Retained ONLY for the v1 applicability matrix UI (heatmap X-axis +
  Phase-2 review filter), which still keys on `Asset.privact.legacyCategory`.
  Scheduled for retirement at C6/C7 when the scoping screen supersedes the v1
  matrix. NOT renamed to `/catalog/asset-types` (that is an additive new
  endpoint) precisely because a rename would break the frozen v1 UI. See
  `open-questions.md` "legacyCategory retirement — C6/C7".
- `GET /catalog/threats` — global read-only threat catalog. **v3 S3-A:** now
  MSW-implemented, sourced from MAGERIT v3 (curated subset; full backfill
  pending — see `open-questions.md`). Supports repeatable `?source=` filter
  (e.g. `?source=MAGERIT v3`); empty = all sources. Real catalog grows with
  upstream library integration (ENISA next).
- `GET /catalog/threats/{tid}` — single catalog threat detail (`404` if absent). **v3 S3-A:** now MSW-implemented.
- `GET /catalog/vulnerabilities` — case study baseline 96; real catalog grows with upstream library integration.
- `GET /catalog/vulnerabilities/{vid}` — single vuln detail
- `GET /catalog/controls` — NIST CSF + CIS v8 Safeguards
- `GET /catalog/countermeasures` — MITRE D3FEND entries
- `GET /catalog/scales` — ROLFP scale definitions, threat probability scale, vuln severity scale. **v3 S3-A:** now MSW-implemented. DISPLAY-ONLY rubric text (`{ threatProbability, vulnSeverity, rolfpImpact }`, each `{ id, name, min, max, levels[] }`); numeric ranges mirror the locked PRIVACT scales verbatim — carries no methodology logic.

> **Catalog scale note.** When catalog sizes grow past ~200 items, `GET /catalog/threats` and `GET /catalog/vulnerabilities` will need query parameters for server-side pagination and filtering. Recommended params: `?q=<search>&category=<id>&page=<n>&page_size=<n>`. The current frontend assumes "load all once, cache forever" — works for case study scale, not for 500+ catalog entries. See `open-questions.md` § "Dynamic catalog architecture" for the open decision on pagination format.

## Projects

- `GET /projects` — list (current user's projects)
- `POST /projects` — create
- `GET /projects/{id}` — full project metadata + phase completion + summary counts.
  **PhaseNav iteration 2:** the `ProjectDetail` response also carries
  `counts: { assets, links, applicableThreats, applicableVulns }` (live,
  aggregated at request time; `applicableThreats/Vulns` = in-scope/included
  counts). Additive — existing consumers unaffected. Drives the PhaseNav status
  dots together with `GET /risk-summary`.
- `PATCH /projects/{id}` — update metadata.
  **v3 C2:** `ProjectDetail`/`UpdateProjectInput` dropped `cia: CiaPriorities`
  and added `sector?: CisaSector` (CISA's 16 critical-infrastructure sectors;
  optional, default none). Stored projects carrying `cia`/`ciaPriorities` are
  migration-stripped on load (no user-visible effect). Sector has no scoring/
  filtering effect yet (consumed at C4). CIA priorities had a live consumer —
  the CVSS-environmental CR/IR/AR auto-default — now a fixed Medium baseline.
- `DELETE /projects/{id}` — delete
- `POST /projects/{id}/finalize` — lock from further edits

## Threat library (working-set overlay — v3 S3-A)

Per-project WORKING SET of threats — the editable overlay layer on top of the
global read-only catalog. Distinct from `/applicable-threats` (the v2 engine-
match pipeline), which is untouched; v3 supersession into the triplet pipeline
lands in a later commit. localStorage-backed in the mock (`projectThreatStore`).
`ProjectThreat` = `CatalogThreat` + `{ projectId, catalogRef?, isCustom }`. A
"keep" copies a catalog threat (`catalogRef` set, `isCustom` false); an "add"
creates a custom one (`isCustom` true, no `catalogRef`).

- `GET /projects/{id}/library/threats` — list the project's working set
- `POST /projects/{id}/library/threats` — keep or add. Body `ProjectThreatInput`
  (`name` required, non-empty → else `400 { message }`). Server assigns `id`
  (`pt-{projectId}-{n}`) + `projectId`. → `201 ProjectThreat`.
- `PATCH /projects/{id}/library/threats/{tid}` — partial edit of an overlay
  record (incl. CIA flags). `404` if `tid` not in this project's set. Identity
  fields (`id`, `projectId`) never overwritten.
- `DELETE /projects/{id}/library/threats/{tid}` — remove from working set only
  (never the catalog). `204`, or `404` if not found.

## Assets

- `GET /projects/{id}/assets` — list assets (and links)
- `POST /projects/{id}/assets` — create one
- `PATCH /projects/{id}/assets/{aid}` — update one
- `DELETE /projects/{id}/assets/{aid}` — delete one
- `PUT /projects/{id}/assets` — bulk replace (for CSV import later)
- `DELETE /projects/{id}/assets/{aid}` — also **cascades** link deletes
  (server removes every link involving the asset before removing the
  asset itself; cf. Links below).

## Links (Phase 5c)

Asset-to-asset links. Undirected, untyped, no metadata. Server stores
the pair with lex-normalized endpoint order (`assetIdA <= assetIdB`) so
duplicate detection is a set lookup.

- `GET /projects/{id}/links` — list all links in the project
- `POST /projects/{id}/links` — body `{ assetIdA, assetIdB }` → `201 Link`;
  validation responses (all with body `{ message: string }`):
    - `400` if either endpoint missing
    - `400` if `assetIdA === assetIdB` (same-id)
    - `409 Conflict` if the normalized pair already exists
- `DELETE /projects/{id}/links/{lid}` — `204` (or `404` if not found)

## Engine output

> **RETIRED in C10 (v2 triplet pipeline).** The v2 server-side triplet
> endpoints below — `POST /compute`, `GET /triplets`, `GET /triplets/{tid}`,
> `GET /risk-summary` (+ `/top-residual`), `PATCH /triplets/{tid}/env-override`
> — are **no longer MSW-registered** and their handlers/stores are deleted. v3
> derives triplets + risk **client-side** (`useLiveTriplets` → `riskTriplets` →
> `residualRiskV3`), so no `/compute` round-trip exists. The shapes are kept
> here as backend-contract reference only; when the real backend lands it may
> reintroduce server-side triplet endpoints (reconcile against the v3 live
> model). The `PATCH /triplets/{tid}/mitigations` block under "Mitigations
> (Phase 4a)" was already retired in C9c; live mitigations use "Mitigations v3".

Phase 2 (Screen 6) — the engine matches catalog threats/vulns against the
project's assets; the user toggles each in/out of scope before triplet
generation.

- `GET /projects/{id}/applicable-threats` → `ApplicableThreat[]`
- `GET /projects/{id}/applicable-vulnerabilities` → `ApplicableVuln[]`
- `PATCH /projects/{id}/applicable-threats/{threatId}` — body `{ included: boolean }`
  → `200 ApplicableThreat`; `400` if `included` is not a boolean; `404` if the
  project/threat is unknown. Path param is the **catalog id** (`TH-46`), the
  per-project natural key.
- `PATCH /projects/{id}/applicable-vulnerabilities/{vulnId}` — same shape,
  path param is the catalog id (`VU-01`).
- `POST /projects/{id}/compute` — trigger triplet generation → `{ status: 'done', computedAt: ISO_DATE }` (mock resolves inline; real backend async — poll, see playbook §4.1)

Contract shapes (mock; reconcile with backend):

```
ApplicableThreat = {
  id, projectId, threatId,         // threatId = catalog ref, e.g. 'TH-46'
  name, type,                      // type: ENISA taxonomy category
  cia: ('C'|'I'|'A')[],            // affected dimensions (F2)
  source,                          // short label for the Source filter
  assetCount,                      // # matched assets; 0 = non-applicable
  included: boolean,
  // --- F1 extension (UI needs; confirm vs backend — see open-questions) ---
  description, sourceRef?: { label, url? },
  assetCategories: string[],       // catalog category ids
  relatedIds: string[]             // vuln ids this threat can exploit
}
ApplicableVuln = { ...same minus `type`; relatedIds = threat ids targeting it }
```

- `GET /projects/{id}/triplets?page&page_size&band&asset_id&min_risk&sort&order&asset_category&threat_type` — server-side paginated/filtered/sorted → `Paginated<Triplet>`. Defaults `page_size=50`, `sort=risk_score`, `order=desc`. `sort ∈ {risk_score, asset_name, threat_name, vuln_name, band}`. **Phase 4b:** `asset_category` + `threat_type` (slugified) added for the dashboard drill-down; page items are enriched with `residualScore`/`residualBand`/`mitigationCount` (Phase 4a list view).
- `GET /projects/{id}/triplets/{tid}` — single triplet detail (UI rarely calls this; the modal renders from the cached row — also used by the Screen 8 `?triplet=` deep-link to fetch an off-page row)
- `GET /projects/{id}/risk-summary` → `RiskSummary` — **project totals, never filtered**. **Phase 4b:** now also returns `mitigatedCount`, `totalReductionPercent`, `highResidualCount`.
- `GET /projects/{id}/risk-heatmap?view=residual|original` → `HeatmapResponse` — Asset Category × Threat Type matrix; cell = max score for the view, plus count/avg/mitigated; row + column totals. Default `view=residual`.
- `GET /projects/{id}/risk-summary/top-residual?limit=N` → `Triplet[]` — triplets sorted by residual score desc, sliced to `limit` (default 10). Enriched with residual fields.

Phase 3 shapes (mock; reconcile with backend — see open-questions Phase 3):

```
Triplet = {
  id,                              // `TR-${projectId}-${assetId}-${threatId}-${vulnId}`
  projectId,
  assetId, assetName, assetCategory,        // denormalized: table/modal need no joins
  threatId, threatName, threatType, threatCia: CiaDim[], threatProbability,  // 0–4
  vulnId, vulnName, vulnCia: CiaDim[], vulnSeverity,                          // 0–5
  assetImpact: { c, i, a },        // max ROLFP cell per column (0–4)
  riskC, riskI, riskA,             // per-dimension risk
  riskScore,                       // max(C,I,A), 0–80
  band: 'low' | 'medium' | 'high'  // 0–8 / 9–29 / 30–80
}
RiskSummary = { projectId, total, high, medium, low, lastComputedAt: ISO|null,
  computedScopeVersion,
  mitigatedCount, totalReductionPercent (0-100), highResidualCount }   // +3 Phase 4b
Paginated<T> = { items: T[], page, page_size, total, total_pages }
```

Phase 4b heatmap shape (mock; reconcile with backend — see open-questions Phase 4b):

```
HeatmapResponse = {
  view: 'residual' | 'original',
  rows: [{ assetCategory (slug), assetCategoryLabel, rowTotal,
           cells: [{ threatType (slug), threatTypeLabel, maxScore: number|null,
                     count, avgScore, mitigatedCount }] }],
  columnTotals: [{ threatType (slug), threatTypeLabel, total }]
}
```
Threat-type axis is derived from the seed's `type` field; asset-category axis is
the 7-value catalog. Both slugified for the `asset_category`/`threat_type` drill
params (matching slugifies the triplet's denormalized labels on both sides).

Catalog defaults feeding the formula: each threat carries `defaultProbability`
(0–4), each vuln `defaultSeverity` (0–5). Sourcing is an open question (see
open-questions § "Dynamic catalog architecture").

**v2 [13/N] — Per-triplet CVSS Environmental override (Option C, part 1).**
Analysts can override the catalog-derived severity per triplet with a
context-specific CVSS 3.1 Environmental Score (Modified Base Metrics +
CR/IR/AR security requirements). The derived 0–5 PRIVACT severity replaces
`vuln.defaultSeverity` in the risk formula **for that triplet only**.

- `PATCH /projects/{id}/triplets/{tid}/env-override` — body
  `CvssEnvironmentalOverride | { enabled: false }`. Persists to
  `envOverrideStore`, runs an inline localized triplet regen so the next
  `/triplets` read reflects the new score (no `/compute` pass needed).
  Response: `{ triplet: Triplet, override: CvssEnvironmentalOverride | null }`.
  `400` if `enabled` missing or override enabled with incomplete payload;
  `404` if the triplet is unknown.

PRIVACT methodology unchanged — formula
`Risk = Applicability × Impact × Probability × Severity` and the 0–4 impact /
0–4 probability / 0–5 severity / 0–80 total scales all preserved; only the
severity DATA INPUT becomes triplet-specific where overrides are enabled.
Two new denormalized fields on `Triplet`: `cvssEnvironmentalOverride` (the
full record when active) + `hasEnvironmentalOverride` (boolean shortcut for
list-view markers). CycloneDX export deliberately UNCHANGED (asset-centric;
per-triplet override doesn't fit the BOM shape); OSCAL emits a third
`characterizations[]` block per active override with `x-privact:env-*`
props.

**v2 [14/N] — Per-asset applicability overrides (Option C, part 2).** The
catalog-side category matching produces a default applicability set; analysts
need to deviate per-asset (e.g. exclude SQL injection on a static-content
asset, or include a typically-non-applicable threat for one critical asset).

- `GET /projects/{id}/applicability-overrides` → `ApplicabilityOverride[]`
- `PUT /projects/{id}/applicability-overrides` — body
  `ApplicabilityOverride[]` (full replacement, not patch). Server validates,
  replaces the project's override list, bumps `scopeVersion`, and runs an
  inline triplet regen so the next `/triplets` + `/risk-summary` reads
  reflect the new applicability set. Response:
  `{ overrides: ApplicabilityOverride[], computedAt: ISO, tripletCount }`.

`ApplicabilityOverride` shape:

```
ApplicabilityOverride = {
  assetId,                                  // entity id (asset OR service)
  type: 'threat' | 'vuln',
  itemId,                                   // catalog id, e.g. 'TH-46' / 'VU-01'
  state: 'applicable' | 'not-applicable',
  createdAt: ISO_DATE
}
```

Engine resolution rule (`src/lib/applicabilityResolver.ts`): an override for
`(assetId, type, itemId)` always wins over the catalog default. Triplet
generation calls the resolver for both threat and vuln; if either resolves
to `effective: false`, no triplet is emitted for that (asset, threat, vuln)
tuple. Per-asset overrides compose with the v2 [13/N] CVSS Environmental
overrides — both are passed to `generateTripletsForProject` and stored
independently. CycloneDX import clears applicability overrides alongside
the other compute-scope state. CycloneDX export emits a single
`x-privact:applicability-overrides` property (JSON-stringified) on the
project component; OSCAL emits one EXAMINE Observation per override.

**Scope versioning (staleness).** The `Project` shape carries
`scopeVersion: number`, bumped by any mutation that affects compute scope
(asset/link CRUD, threat/vuln inclusion PATCH). `RiskSummary` carries
`computedScopeVersion` — the project's `scopeVersion` when `/compute` last ran.
The frontend flags triplets stale when `project.scopeVersion >
computedScopeVersion`. This is the mock's mechanism; the real backend may model
staleness differently (hash, modifiedAt, etc.) — see open-questions § "Backend
scope-versioning contract".

## Mitigations (Phase 4a — Screen 8)

- `GET /projects/{id}/triplets/{tid}/mitigations` → `TripletMitigations` —
  engine-filtered applicable controls/countermeasures + current selection +
  server-computed residual. `404` if the triplet doesn't exist.
- `PATCH /projects/{id}/triplets/{tid}/mitigations` — **full-state** body
  `{ selectedControlIds, selectedCountermeasureIds }` → `TripletMitigations`
  (recomputed residual). Idempotent; server replaces the selection.
- `GET /projects/{id}/mitigations/picker?type=control|countermeasure&tripletIds=tid1,tid2,…`
  → `BulkPickerResponse` — **added during Screen 8 build** to support the
  K-of-N applicability indicator in the bulk picker. Returns catalog entries
  of `type` that apply to ≥1 of the given triplets, each with its
  `applicableTripletIds` (K) against `selectedTripletCount` (N).
- `PATCH /projects/{id}/mitigations/bulk` — body `BulkApplyRequest`
  (`{ controlId | countermeasureId, tripletIds }`) → `BulkApplyResponse`
  (`{ updated[], skipped[{tripletId, reason}] }`). Server appends the entry to
  each applicable, not-already-selected triplet.

Residual formula (closes risk-engine-logic.md open-question #1): multiplicative,
single pool (controls + countermeasures), score-level uniform, floored at 0:
`residual = round(original × Π(1 - reduction_i))`. Bands identical to Phase 3.

Phase 4a shapes (mock; reconcile with backend — see open-questions Phase 4):

```
Control = { id, name, family, description, defaultReduction (0.1–0.7),
  source: 'NIST_CSF'|'CIS_v8', sourceRef?: {label,url?},
  applicableAssetCategories: string[] (category ids), applicableVulnIds: string[] }
Countermeasure = { …same; source: 'MITRE_D3FEND' }
TripletMitigations = { tripletId, originalScore, applicableControls[],
  applicableCountermeasures[], selectedControlIds[], selectedCountermeasureIds[],
  residualScore, residualBand }
BulkPickerResponse = { type, selectedTripletCount, items: [{ item, applicableTripletIds[] }] }
BulkApplyResponse = { updated: string[], skipped: [{ tripletId, reason: 'not_applicable'|'already_selected' }] }
```

Catalog reads: `GET /catalog/controls` and `GET /catalog/countermeasures`
return the full arrays (mock); paginate when catalogs grow past ~200.

## Output (Phase 4c — Screen 10 Export)

- `GET /projects/{id}/report-preview` → `ReportPreviewResponse` — aggregated
  preview for the on-screen report (metadata + summary + top-N per section).
  The MSW mock folds it from existing in-memory state; top-N sorting server-side.
- `GET /projects/{id}/report.pdf` / `.xlsx` / `.json` — **sync** binary/text
  downloads. Each returns `Content-Disposition: attachment; filename="{slug}-
  risk-report-{YYYY-MM-DD}.{ext}"` (slug = lowercased project name, non-alnum →
  hyphen). The frontend blob-downloads via an anchor click + `revokeObjectURL`.
  - `.json` = the `ReportPreviewResponse` serialized.
  - `.pdf` / `.xlsx` = **valid placeholder** documents in the mock
    (`src/lib/officeBlobs.ts` builds a minimal real PDF + a STORED-ZIP XLSX, no
    deps); real document generation is a backend concern (see open-items).
  - Real backend may be slow (>10s) → async/polling fallback is deferred (Q4).
- `GET /projects/{id}/report.cyclonedx.json` — **v2 commit 02**: a valid
  **CycloneDX 1.6** BOM with the project as the root component, every asset as
  a Component (and application-api assets *also* as a Service), links as
  Dependencies, and in-scope vulns as Vulnerabilities (with `cwes[]`, CVSS
  ratings, and `affects[]` derived from `vuln.assetCategories ∩
  asset.legacyCategory`). PRIVACT-specific data (`category`, `residesIn`,
  `rolfp`, project `scope`) rides on `properties[]` entries with the
  `x-privact:` namespace prefix. **v3 C2:** the three `x-privact:cia.*` props
  were removed (project CIA priorities dropped) — **export shape change**. MIME
  `application/vnd.cyclonedx+json; version=1.6`. Filename
  `{slug}-bom-{YYYY-MM-DD}.cyclonedx.json` (the `-bom-` convention vs.
  `-risk-report-` for the other formats — a BOM is not a risk report). Adapter:
  `src/lib/cyclonedxAdapter.ts` (pure, no deps).
- `GET /projects/{id}/report.oscal.json` — **v2 commit 12**: a valid
  **NIST OSCAL Assessment Results 1.1.2** JSON document. Project metadata
  in `assessment-results.metadata` (title + parties + `x-privact:*` props
  carrying methodology / formula / scale / scopeVersion; **v3 C2** removed the
  `x-privact:project-cia` prop — export shape change).
  `results[0]` contains one `observations[]` per Asset + Service (subject
  of assessment), one `risks[]` per triplet (with likelihood / impact /
  severity / risk-band / risk-score facets in `characterizations[0]`,
  optional CVSS 4.0 facets in `characterizations[1]` when the vuln has
  CVSS data, and a `threat` ref to MITRE CWE when the vuln carries
  `cweRefs`), and one `findings[]` per high-band triplet (objective-id
  target with `not-satisfied` status). Selected controls/countermeasures
  surface as `mitigating-factors[]` on the corresponding risk. MIME
  `application/oscal.assessment-results+json`. Filename `{slug}-oscal-ar-
  {YYYY-MM-DD}.oscal.json`. Consumable by the OSCAL toolchain and GRC
  platforms (eMASS, Xacta, Atlasity, RegScale). Adapter:
  `src/lib/oscalAdapter.ts` + `oscalAdapterEntities.ts` (pure, no deps).
  Subset NOT covered: imported Assessment Plan (placeholder href), SSP
  cross-refs, attestation entries.
- `POST /projects/{id}/import.cyclonedx` — **v2 commit 06**: replace the
  project's asset inventory with the contents of a CycloneDX BOM. Closes the
  interop loop opened by `report.cyclonedx.json`. The client parses the BOM
  offline via `src/lib/cyclonedxImporter.ts` (lenient 1.4 / 1.5 / 1.6 support)
  and POSTs the *resolved* internal entities; the server just persists. Body:
  `{ assets: Asset[], services: Service[], links: Link[] }` — fresh internal
  IDs already assigned. Side effects: replace-all on assets/services/links,
  clear applicability state, clear computed triplets, clear mitigation
  selections, bump `scopeVersion`. Response: `{ success, importedAssets,
  importedServices, importedLinks }`. User runs Compute in Phase 3
  post-import to regenerate triplets.
- `GET /projects/{id}/requirements` — structured final requirements (grouped by NIST CSF function)

`ReportPreviewResponse` shape:

```
{ metadata: { projectId, projectName, description?, generatedAt, lastComputedAt,
    isStale, scopeVersion, computedScopeVersion: number|null },  // v3 C2: ciaPriorities removed
  summary: { totalAssets, totalLinks, totalApplicableThreats, totalApplicableVulns,
    totalTriplets, bandCounts{low,medium,high}, mitigatedCount,
    mitigationCoverage (0-1), totalReductionPercent (0-100), highResidualCount },
  assetInventory: { total, topByImpact: Asset[20], truncated },
  threatsInScope: ApplicableThreat[],   // full in-scope
  vulnsInScope: ApplicableVuln[],        // full in-scope
  riskRegister: { total, topByResidual: Triplet[20], truncated },
  mitigationsApplied: { total, topByContribution: [{ mitigationId, label, kind,
    sourceRef?, appliedCount, reductionContribution }][10], truncated } }
```

## External vulnerability sources (client-side adapters — NOT MSW endpoints)

**v3 C3+.** The browser calls these external APIs directly via
`src/lib/vulnSources/`; the **CVE records they return are NOT MSW endpoints** —
they're fetched client-side and cached in IndexedDB. (Only the analyst override
endpoints below are MSW; the inventory is 55 after C4 = +2 overrides.) MSW
passes through non-`/api/` requests, so live calls work in dev. CORS posture
(probed 2026-06, browser-direct):

| Source | Endpoint | Method | Browser CORS | Status |
|---|---|---|---|---|
| NVD CPE | `services.nvd.nist.gov/rest/json/cpes/2.0` | GET | `ACAO: *` keyless | **enabled** (C3 — CPE picker) |
| NVD CVE | `services.nvd.nist.gov/rest/json/cves/2.0?cpeName=` | GET | `ACAO: *` keyless | **enabled** (C4 — match by CPE) |
| OSV | `api.osv.dev/v1/query` (by purl) | POST | `ACAO` reflects origin, preflight 200 | **enabled** (C4) |
| EUVD | `euvdservices.enisa.europa.eu/api/search` | GET | **no `ACAO`** — blocked | **disabled** (needs proxy, phase E) |

**v3 C4 — vulnerability severity overrides (MSW, analyst data):**
- `GET /projects/{id}/vulns/overrides` — `{ [cveId]: severity 0-5 }`.
- `PATCH /projects/{id}/vulns/{cveId}/override` — body `{ severityOverride: 0-5 | null }`
  (null clears). Returns the project's full override map. The CVSS-derived
  `defaultSeverity` (round(cvss/2)) is never overwritten; this is the analyst's
  explicit override only. CVE records + per-asset sync snapshots live in
  IndexedDB (cache-class), keyed `vulns:{projectId}:{assetId}`.

- **NVD key**: accepted only as an `apiKey` request header → makes the request
  non-simple → browser fires an OPTIONS preflight that NVD answers **403** →
  keyed requests are browser-blocked. The adapter attempts the key once per
  session and auto-degrades to keyless; the key activates behind a future proxy.
- **Rate limit**: keyless NVD ≈ 5 req / rolling 30s → adapter serializes calls
  through a min-gap queue, caches in **IndexedDB (24h TTL)**, and backs off on
  429/503 (honoring `Retry-After`). The picker also debounces (~400ms).
- **Manual `cpe:2.3` entry** is always available (the CORS-blocked-world
  fallback), validated against the cpe:2.3 format.

## Mitigations v3 (Phase 4 — Screen 8, vuln-instance-anchored)

**v3 C8.** Replaces the v2 triplet-anchored mitigation model ON THE MITIGATIONS
ROUTE (the v2 `/triplets/{tid}/mitigations` + bulk/picker endpoints above stay
live — still consumed by Dashboard / Export until C9). Mitigations attach to a
vuln INSTANCE `(projectId, assetId, cveId)` and act only on the Severity factor;
residual risk is recomputed live on the client (`src/lib/residualRiskV3.ts`), so
there is no server residual here. Endpoint inventory 62 → 64 (+2).

- `GET /projects/{id}/mitigations-v3` → `MitigationRecord[]` — the project's
  non-empty mitigation records. Prunes orphans whose asset no longer exists.
- `PUT /projects/{id}/mitigations-v3` — **full-list replace**, body
  `MitigationRecord[]`; `400` on a malformed record; returns the stored list.
  Empty records (no remediate, no countermeasures) are dropped server-side.

```
MitigationRecord = {
  assetId, cveId,
  remediate?: { fixedVersion?, note? },          // presence → residual severity 0 (dominates)
  countermeasures: AppliedCountermeasure[]        // mitigate (strongest-only)
}
AppliedCountermeasure = {
  techniqueId,                                    // D3FEND "D3-xx"
  tacticId,                                       // D3FEND tactic
  effectivenessDefault,                           // PRIVACT default for the tactic (≤0)
  effectivenessOverride?                          // analyst, integer [-5, 0]
}
```

## Countermeasure source (client-side snapshot — NOT an MSW endpoint)

**v3 C8.** D3FEND is a bundled, versioned **snapshot** (`src/lib/d3fend/`),
generated offline from the official ontology artifacts; the live layer is stubbed
behind a SourceAdapter-conformant interface (EUVD pattern). Probe (2026-06,
browser-direct): the D3FEND API is CORS-clean (`ACAO: *`) but has **no per-CWE
inference route** (only ATT&CK-technique routes + static ontology downloads), so
snapshot-only ships. CWE→countermeasure is a faithful sparse overlay (D3FEND has
no broad client-derivable mapping); the full 271-technique catalog is the picker
universe. See `standards-decisions.md`.

## Auth

- `GET /me` — current user info
