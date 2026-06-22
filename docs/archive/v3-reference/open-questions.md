# Open Questions (current through v3 / C10)

Things identified but not yet decided. Resolve before the relevant work begins.
The v2 triplet pipeline retirement is CLOSED (C10 — see the resolved item in the v3
mitigations section). Backend-reconciliation items remain valid for the future
backend-integration phase.

## Active

### Standards / engine

- **CVSS 4.0 strict Environmental calculation.** Current implementation in `src/lib/cvssEnvironmental.ts` is a CVSS **3.1**-style approximation. For CVSS 4.0 vectors, the calculator still applies the 3.1 formula against the vector's AV/AC/PR/UI/C/I/A letters (4.0-only fields typed but not consumed — full 4.0 needs MacroVector tables). Whether to integrate a real CVSS 4.0 library (e.g. `@pandatix/js-cvss`) for strict scoring, or keep the approximation labeled "PRIVACT environmental approximation" — pending decision.
- **Custom entity creation UIs** — deferred from v2 commits 07 (vulnerabilities), 08 (threats), 10 (actions). Backend persistence model needs to support arbitrary user-authored entries before the UIs can ship. Sequenced after the backend integration phase (E).
- **CVSS Safety parameter conditional UI** — safety-critical project toggle that surfaces additional Safety metric inputs. Listed in `docs/v2-migration-progress.md` "Planned"; depends on the project model gaining a `safetyRelevant: boolean` flag.

### Dynamic catalog architecture (unchanged from pre-v2 — backend team to resolve)

1. **Upstream source libraries:** Which external libraries does the backend integrate (MAGERIT v3, EBIOS v2, NIST CSF, CIS v8 Safeguards, MITRE D3FEND, ENISA, OWASP, sector-specific catalogs), and in what priority order?
2. **Refresh cadence:** How often does the backend pull from upstream libraries? Do user projects pin to the version they were assessed against, or follow the latest?
3. **Multi-tenancy model:** Single shared catalog vs scoped per organization with optional customization?
4. **`sourceRef` semantics post-integration:** Deep link into upstream library website, backend-rendered detail page, or display metadata only?
5. **Catalog scale and pagination:** Will `/catalog/threats` and `/catalog/vulnerabilities` need server-side pagination as the catalog grows? Recommended threshold ~200 items.
6. **Default probability / severity sourcing:** Embedded in catalog entries, derived from a threat-type taxonomy, or per-project user input?

### Backend contract reconciliation (mock invented during v1/v2 dev)

The frontend invented contract shapes for many endpoints in the absence of a backend. Each needs reconciliation when the real backend lands.

- **Phase 3 — triplets & risk scoring:** denormalized `Triplet` shape (inlines `assetName`/`assetCategory`/etc.), `defaultProbability`/`defaultSeverity` sourcing, sync vs async `/compute`, triplet ID format (`TR-{projectId}-{assetId}-{threatId}-{vulnId}` for determinism), scope-versioning contract (mock uses integer `scopeVersion` + `computedScopeVersion`; backend may use content hash / timestamps).
- **Phase 4a — mitigation planner:** residual formula **must match** (frontend: multiplicative, single pool, score-level uniform, floored at 0 — `residual = round(original × Π(1 - r_i))`). Reduction pool unified vs separated stages? Reduction granularity (score-level vs per-dimension)? Bulk-picker endpoint (`GET /projects/:id/mitigations/picker`) — added during Screen 8 build, confirm backend will expose equivalent. Applicability identifiers — catalog uses category-id slugs vs triplet's denormalized labels.
- **Phase 4b — dashboard:** threat-type taxonomy stability (heatmap X-axis derived from seed `type`), `mitigatedCount` semantics (≥1 selection vs reduction threshold vs fully mitigated), heatmap cell value (max vs avg vs count), slug stability for drill params.
- **Phase 4c — export:** report rendering fidelity (preview vs full doc), sync vs async download, `report-preview` vs `requirements` endpoint relationship, project finalization integration (`/finalize` exists but Export does not call it).
- **Phase 2 engine output (Screen 6):** extended `ApplicableThreat`/`ApplicableVuln` shape (`description`, `sourceRef`, `assetCategories`, `relatedIds` — F1 extension; confirm `cia` semantics F2 — set of affected dims vs single dominant), PATCH path param (catalog id vs instance id), non-applicable engine output (does engine return `assetCount === 0` items?).
- **v2 [13] env-override + v2 [14] applicability-override** — endpoint shapes invented during build; both regenerate triplets inline server-side. Backend must implement equivalent or expose a refresh signal.

Full per-phase detail with rationale stays in the per-phase sections below for backend developer reference.

### UX behaviors

- **Recompute triggers:** does the engine recompute triplets automatically when assets change, or does the user trigger explicitly?
- **Project lock semantics:** when Finalize is clicked, is the lock soft (warn on edit) or hard (read-only forever)?
- **Phase 2 suppression:** allow user to mark threats/vulns as "out of scope" with comment? Backend support needed.

### Project / process

- **Production hosting:** institutional vs OVH vs AWS Frankfurt. Consortium decides.
- **i18n:** EN-only, EN+EL bilingual, or other? Consortium decides.
- **Real Keycloak realm:** when do we get credentials? Until then, auth is stubbed.

### v3 taxonomy transition

- **legacyCategory retirement — C6/C7.** From C1a, `Asset.assetType` (CycloneDX)
  is the canonical asset taxonomy. `Asset.privact.legacyCategory` (7 v1 slugs) +
  the v1 applicability matrix remain FROZEN TRANSITIONAL, consumed only by the
  v1 pipeline: `applicabilityResolver`, `tripletGenerator`, the Phase-2 review
  "Asset Category" filter, the dashboard heatmap X-axis (`heatmapAggregation.ts`
  keys cells by legacy slug), the `applicableAssetCategories` seed matrix
  (controls / countermeasures / mitigations), `/catalog/asset-categories`, and
  the `x-privact:category` / `x-privact:legacy-category` export props. These
  retire at **C6/C7** when the scoping screen + per-CPE vuln matching supersede
  the v1 matrix. The C1a `MAGERIT_TO_CDX` crosswalk (`src/lib/mageritCrosswalk.ts`)
  is the bridge: it expresses asset applicability in CycloneDX terms ahead of
  that migration. NOTE: the legacy→CycloneDX map is many-to-one (e.g. Database
  and Application/API both → `application`), so a future hard migration of the
  matrix will change applicability granularity — to be handled deliberately in
  C6/C7, not silently.

### v3 mitigations / D3FEND (C8)

- **[PHASE E — deferred from C9c] D3FEND→NIST/CIS crosswalk + richer
  CWE→countermeasure suggestions (C8).** Only ~10 CWEs (mostly memory-safety) have
  a faithful direct `weakness-of`→defensive-technique link in the D3FEND 1.4.0
  ontology; there is no broad client-derivable mapping and no per-CWE live API
  route. C8 ships the faithful overlay + the full 271-technique catalog as
  fallback. **If** richer CWE→technique suggestions are wanted later: (a) consume
  D3FEND's curated SPARQL inference via a backend/proxy (phase E), or (b) ingest an
  official mapping artifact if MITRE publishes one. The **D3FEND→NIST/CIS
  crosswalk** enhancement (surfacing the reference NIST CSF / CIS controls that map
  to a chosen D3FEND technique, now that NIST/CIS are kept reference-only per C9c)
  rides the same phase-E backend/proxy work.
- **D3FEND live layer stubbed (C8).** Snapshot-only ships; the live adapter is
  `enabled:false`. Re-enable behind a phase-E proxy if live refresh is wanted
  (the full ontology is a 4.7MB download — re-derivation is not worth doing at
  mitigation time).
- **[PHASE E — deferred from C9c] Lazy-load the D3FEND snapshot / route-level
  code split (C8→C8.1).** The 271-technique snapshot (+definitions) is ~40 kB raw
  in the main bundle. It is only needed on the Mitigations route — `import()` it
  (and the mitigations components) behind a route-level split so it drops out of
  the initial chunk.
- **[PHASE E — deferred from C9c] `mitigations-v3` endpoint naming — rename at
  backend swap-in (C8→E).** The `-v3` suffix mirrors the client store key during
  the v2/v3 coexistence window. The v2 mitigation endpoints retired in C9c; when
  the real backend lands, rename to the unsuffixed `/projects/{id}/mitigations`
  (and align the store key per the migrate-on-read policy — no data-lossy key bump).
- **Browse-all-techniques fallback in the D3FEND picker (C8.1/C9).** The picker
  already exposes the full tactic-grouped catalog via the searchable Select for
  every CVE (incl. CWEs with no overlay mapping). Candidate enhancement: a more
  prominent, browsable tactic-grouped "browse all techniques" mode (accordion /
  definitions) so analysts can explore countermeasures for unmapped CWEs without
  relying on search recall.
- **v2 residual pipeline retirement is staged across C9 (C8→C9c).** The v2
  multiplicative residual (`residualComputation.ts`, `mitigationStore`, the
  `/triplets/{tid}/mitigations` + bulk/picker endpoints, oscalAdapter mitigation
  export, the v2 dashboard handlers `risk-heatmap`/`top-residual` + `dashboardHooks`)
  is being repointed screen-by-screen, not deleted:
  - **C9a (done):** Dashboard reads the v3 live residual model;
    `TopResidualList` repointed (component kept). The v2 dashboard handlers/hooks
    are now unused by any screen but LEFT IN PLACE (removed in C9c).
  - **C9b (done):** Export reads the v3 live model client-side (report preview +
    JSON/PDF/XLSX + CycloneDX v3 + OSCAL v3 + generation stamp). The v2 export
    handlers (`report-preview`, `report.*`, `report.cyclonedx/oscal`),
    `reportsHooks`/`reports.ts`/`downloadHelpers`, and the v2 `cyclonedxAdapter`/
    `oscalAdapter` v2 paths are now unused by any screen but LEFT IN PLACE.
  - **C9c (done):** DELETED the dead v2 paths — the dashboard handlers
    (`risk-heatmap`/`top-residual` + `dashboard`/`dashboardHooks`), the v2 export
    handlers/hooks/adapters (`exports`, `report-preview`/`report.*`/
    `report.cyclonedx`/`report.oscal`, `reports`/`reportsHooks`, `downloadHelpers`,
    the v2 `cyclonedxAdapter` [its 3 builders relocated to
    `lib/export/cyclonedxComponents.ts`] + v2 `oscalAdapter`), the v2 mitigation
    handlers/hooks/UI (`mitigations`/`mitigationsHooks`, `MitigationsPanel`+Header,
    `MitigationsBulkPickerModal`, `MitigationDetailModal`, `StalenessBanner`,
    `CatalogItemRow`, `actionFilter`, `ActionFrameworkFilters`). Endpoints 64→52.
    **IMPORTANT caveat — could NOT delete `residualComputation.ts` + the v2
    `mitigationStore`:** the reverse-import check found they are STILL consumed by
    the v2 triplet pipeline (`tripletStore`, the `triplets`/`imports`/
    `applicabilityOverrides` handlers), which is still MSW-registered and was out of
    C9c scope. Their removal is now blocked on retiring the v2 triplet pipeline (new
    deferred item below). NIST/CIS catalogs KEPT as reference (see standards-decisions).
    **[RESOLVED in C10]** — the v2 triplet pipeline was retired and both
    `residualComputation.ts` + the v2 `mitigationStore` were deleted. See "v2 triplet
    pipeline retirement — DONE (C10)" below.
- **v2 triplet pipeline retirement — DONE (C10).** Retired in two commits.
  **C10a:** `PUT /applicability-overrides` made store-only — dropped the inline
  `generateTripletsForProject` + `tripletStore.setComputed` regen. That regen was
  the **last live route** into the v2 cluster; its output (v2 triplets) was never
  read by any v3 surface, so removing it is behaviorally inert for v3 risk. The
  override still persists and the client hook's project-scoped invalidation still
  re-reads it into the v3 OSCAL export's `x-privact:applicability-overrides`
  metadata (the only v3 consumer of applicability overrides — they never fed v3
  RISK numbers; v3 in/out-of-scope is the separate scope-pruning model,
  `useTripletScope`). **C10b:** with zero live routes left, deleted the 14
  orphaned modules — `lib/tripletGenerator`, `lib/residualComputation`,
  `mocks/data/{tripletStore,mitigationStore,envOverrideStore}`,
  `mocks/handlers/triplets` (+ its 5 endpoints: `GET /triplets`,
  `GET /triplets/:tid`, `GET /risk-summary`, `POST /compute`,
  `PATCH /triplets/:tid/env-override`), `api/triplets`/`tripletsHooks`,
  `components/TripletDetailModal`, and the `components/cvss/` env-override cluster
  (`CvssEnvironmentalSection`/`CvssEnvironmentalEditor`/`CvssComparisonBadges`/
  `ModifiedBaseMetricsForm`/`SecurityRequirementsForm`). `lib/cvssEnvironmental.ts`
  (CVSS env calc) was KEPT — live via `vulnSources/cvssScore.ts`. The v3
  equivalents (`mitigationV3Store`, `residualRiskV3.ts`) were untouched. Endpoints
  52 → 47.
- **Export stamp open items (C9b).** (a) Tool build SHA is read from
  `import.meta.env.VITE_BUILD_SHA` (falls back to `dev`) — wire a real SHA at CI
  build time. (b) Scope descriptor is a **state-hash** over in-scope triplet ids,
  NOT `project.scopeVersion` (which v3 scope pruning does not bump) — revisit if
  a real v3 scope-version counter is added. (c) **[PHASE E — deferred from C9c]**
  CWE-version pinning in the export stamp: the CWE taxonomy version is not pinned
  in-repo (cited as "unpinned" in the stamp); pin it if a CWE catalog version
  becomes available. (d) OSCAL findings key off **residual** High band
  (post-mitigation remaining risk) — flagged for audit; switch to original band
  if inherent-risk findings are preferred.
- **PhaseNav runs the live triplet derivation on every project page (C9a).** For
  live gating, `PhaseNav` calls `useLiveTriplets`, so Setup/Assets/Review pages
  now also fire the assets/threats/matches/scope queries + per-asset IndexedDB
  vuln-snapshot reads (React Query dedupes; cheap + cached, but it is extra work
  on pages that don't otherwise need it). If it ever shows up, gate the heavy
  per-asset reads or expose a lighter "≥1 triplet exists" server signal.

### v3 external sources

- **EPSS not yet sourced (C4).** `VulnRecord.epss` is typed but always undefined
  — neither NVD nor OSV returns EPSS. Add a FIRST.org EPSS adapter
  (`api.first.org/data/v1/epss?cve=`) when EPSS is wanted (CORS unverified).
- **CVSS v4 native support — later (C4).** `baseScoreFromVector` computes ONLY
  from CVSS 3.0/3.1 vectors. OSV-only CVEs whose source gives a **2.0 or 4.0**
  vector (and no number) get `defaultSeverity = undefined` and a "set manually"
  badge — the analyst sets severity via the override column. NO cross-version
  pseudo-scores. A native CVSS 4.0 MacroVector calculator (and a CVSS 2.0 base
  calc) would let these auto-default; tracked here with the existing "CVSS 4.0
  strict" item. NVD-sourced CVEs are unaffected (NVD provides the number).
- **Import does not clear vuln overrides / sync snapshots (C4).** A CycloneDX
  re-import gives assets fresh ids → old IndexedDB sync snapshots orphan (TTL-
  evicted). `cveId`-keyed overrides survive (still valid for the same CVE). Sector
  is serialized on export but the asset-only import path doesn't restore project-
  level sector. Revisit if/when a full project-import lands.

- **EUVD — first backend-proxied source (phase E).** The ENISA EU Vulnerability
  Database (`euvdservices.enisa.europa.eu`) sends **no CORS headers** a browser
  can use (probed C3) → it cannot be called client-side. Shipped `enabled:false`
  with a UI notice. **No third-party CORS proxies — ever** (user directive). EUVD
  becomes the **first source routed through the PRIVACT backend proxy** when the
  E (backend integration) phase lands; the adapter interface
  (`src/lib/vulnSources/`) is already proxy-ready (swap the fetch target, keep
  `searchCpe`/`queryByCpe`). NVD's keyed path (preflight-blocked in-browser)
  rides the same proxy.

- **Service threat-matches are inert (C6.5).** Services (the 14th asset type)
  carry no CPE → no CVE → no triplet → no risk. The matching matrix (C5b) still
  lets the analyst match threats to the `service` asset type, but those matches
  produce NO candidate triplets (a triplet needs a vulnerability). This is
  surfaced — not silent — via the "Service · no CVE" note in Assets, the service
  form Alert, and the Scope-screen services note. If a future requirement wants
  service-level risk, it needs a non-CVE vulnerability source for services
  (revisit then). Component assets, by contrast, now REQUIRE ≥1 CPE.
- **Threat-probability suggestion heuristic — refine with ENISA prevalence
  (C5c-2).** The probability suggestion (`src/lib/probabilitySuggest.ts`) is a
  deliberately simple, transparent heuristic, NOT authoritative — the analyst
  overrides every value that enters the formula. Current rule: baseline 2; for
  DELIBERATE threats a Purdue/ISA-95 zone-exposure modifier (L5/L4 +1 · L3/L3.5 0
  · L2/L1/L0 −1, clamped 0-4; custom zones neutral); non-deliberate threats get
  the flat baseline (physical/network exposure doesn't drive their environmental
  likelihood). Planned refinement: blend in ENISA threat-landscape prevalence +
  NIST 800-30 adversarial/non-adversarial signal once those catalogs are loaded
  (NIST App.E is deferred; ENISA prevalence isn't in the taxonomy xlsx). Until
  then the heuristic is labelled as such in the UI.
- **Threat-match suggestion seeding — make GET pure (phase E).** `GET
  /projects/{id}/threat-matches` (C5b) seeds MAGERIT crosswalk suggestions as a
  side-effect on read (mock convenience, guarded by a per-threat `seeded` set so
  removals stick). The backend must seed suggestions at **threat-keep time**
  (when a threat enters the working set) so GET stays pure/idempotent — no
  write-on-read.

- **Sector relevance badges (C4b) — backend aggregation, phase E.** CISA CSAF →
  CVE→sector index (phase E); client-side fetch of thousands of advisories is not
  feasible. The sector-relevance badge + optional default-off filter (blueprint
  delta 5) therefore defer to the same backend-proxy phase as EUVD: the backend
  builds the CVE→sector map from the CISA ICS CSAF advisory corpus and serves it
  behind the adapter interface, rather than the browser pulling the full advisory
  set. No client-side C4b build.

### v3 catalog data

- **MAGERIT threat catalog — full extraction.** **CLOSED in C1b.** The global
  threat catalog (`src/mocks/data/catalog/threats.ts`) now ships the full
  MAGERIT v3 Libro II §5 catalog — **55 entries** (57 source codes minus 2 that
  MAGERIT marks obsolete: E.7, E.14). Parsed from the user-provided
  `./data-prep/magerit-v3-libro2.pdf` via pypdf (isolated venv; poppler /
  pdftotext were unavailable). CIA dimensions, asset-type codes and origin were
  extracted verbatim (mapping `[C]`→C, `[I]`→I, `[D]`→A; `[A]`/`[T]` dropped);
  names + descriptions curated to concise English. 3 entries (A.3, A.4, A.11)
  were hand-corrected for PDF source defects. NOTE: descriptions are curated
  English renderings, not verbatim source text — an English-gloss vs faithful-
  Spanish decision flagged at the C1b gate.
- **NIST SP 800-30r1 App.E threat events — DEFERRED (C5a decision).** Add via a
  clean structured CSV/xlsx drop, later. The official PDF is reachable
  (`data-prep/nist-sp800-30r1.pdf`, nvlpubs.nist.gov) but Tables E-2 (adversarial)
  / E-3 (non-adversarial) are a two-column prose layout with full-width
  sub-headers + multi-line cells that does NOT extract faithfully — three parser
  attempts (pypdf linear, pypdf y-band, pdfplumber period-cell + gap-zone) all
  mis-aligned or mis-counted (e.g. 68 names vs 81 descriptions). Per the MAGERIT
  "no silent subset" rule, NIST was NOT shipped in C5a and is NOT hand-transcribed
  (user decision). To add: drop `data-prep/nist-800-30-threat-events.{csv,xlsx}`
  with columns `table` (E-2/E-3) · `event` · `description`, then load as a fourth
  source. (NIST CPRT does not publish App.E events as machine-readable JSON —
  checked.)
- **Threat catalog now exceeds the load-all threshold (C5a).** With MAGERIT 55 +
  ENISA 180 + ATT&CK ICS 79 = **314** catalog threats, the combined catalog
  crosses the ~200-entry pagination threshold noted for `catalogThreats`. MSW
  still load-alls (fine at this scale; the client filters by source), but the
  real backend MUST paginate + push `?source` filtering server-side. The
  ThreatLibrary catalog table is not virtualized — acceptable at 314, revisit if
  more sources (NIST, BSI) push it materially higher.
- **BSI elementary threats — deferred (C5a Q1).** Not loaded in C5a; revisit per
  blueprint §6 with availability/version verification.
- **Full CWE catalog backfill / OWASP-tagging of the CWE vuln catalog.**
  **SUPERSEDED by v3.1.** The S3-B plan (full CWE 4.20 catalog behind MSW
  pagination + OWASP Top 10:2025 facet, keep-then-map vuln overlay) was
  cancelled before any code landed. v3.1 replaces it with the **CVE-per-CPE**
  model: vulnerabilities are matched live per asset CPE via client-side source
  adapters (NVD / EUVD / OSV), default severity = `round(CVSS/2)`, and CWE is
  derived from the CVE→CWE chain rather than browsed as a catalog. See
  `docs/v3-blueprint.md` §2 (deltas 3-4) and §5 (C4). Residual OWASP-tagging of
  threats/vulns, if still wanted, is a post-C5 decision (blueprint §6).

## Resolved

- **Threat-actor taxonomy — keep or drop?** → DROPPED (v3.1 delta 11, built in
  TA-1). The ENISA 4-category threat-actor model (Setup profile, per-threat
  `applicableActors`, Phase-2 de-emphasis/chips/filter, Catalog "ENISA Actors"
  sub-tab) is removed. Materiality was mapped before removal: actors never
  entered the risk formula, applicability, probability, or the `TR-*` triplet id
  — display/highlight/filter/export-metadata only. **Export contract change for
  backend reconciliation:** the OSCAL Assessment Results per-threat prop
  `x-privact:threat-actors` is no longer emitted (parallels C2's `x-privact:cia.*`
  drop); CycloneDX BOM and report-preview are unaffected. Threats are now
  classified by type + deliberate/accidental origin only. See
  `docs/v3-blueprint.md` §4 "Threat-actor removal (TA-1)".
- **Methodology adaptation (MONARC formula)?** → REJECTED. Methodology unchanged throughout v2 (user direct quote in `CLAUDE.md` "METHODOLOGY PRESERVATION").
- **CycloneDX integration depth?** → Full standards-native internal model (γ → α evolution). Commits 02-03 onward; final shape locked in commit 03.
- **v2 → main merge?** → DEFERRED. Per user "Option A merge to main" pending stakeholder review settling. See `docs/next-phase-plan.md`.
- **OSCAL version?** → 1.1.2 Assessment Results profile. v2 commit 12.
- **ENISA scope?** → 2022 Threat Taxonomy, 12 top-level + 25 subcategories. v2 commit 08.
- **NIST variant?** → NIST CSF v2.0 + NIST 800-53 controls. v2 commit 10.
- **Heatmap library?** → Custom inline SVG, no new dependency (`src/components/RiskHeatmap.tsx`). Resolved during Screen 9 build.
- **Vercel preview URL?** → `risk-frontend-git-v2-standards-aligned-ialiprantis-prvs-projects.vercel.app` (stable branch alias).
- **MSW build-time gating?** → `VITE_USE_MOCKS=true` required in Vercel env. Resolved in commit `1319b8c`.
- **Tags:** `v1.0` on `main` `4f9feee` (pre-v2 baseline); `v2.0` on `v2-standards-aligned` `48a762f` (standards alignment complete). Both pushed to origin 2026-05-28.
