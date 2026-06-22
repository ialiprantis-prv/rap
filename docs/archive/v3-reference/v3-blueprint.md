# PRIVACT v3 Blueprint — v3.1

Supersedes v3.0 of this document. Companion docs (authoritative for detail):
`docs/tool-documentation.md` (what the tool does, integrations, assumptions, UI
patterns) and `docs/user-requirements.md` (UR-A1…UR-I5). This file is the
build-facing view: invariants, deltas, data model anchors, correction plan, and the
commit sequence.

---

## 1. Invariants (never change)

`Risk_d = Impact_d × ThreatApplicability_d × Probability × Severity` per d∈{C,I,A};
`Max Risk = max(C,I,A)` 0–80; bands 0–8 / 9–29 / 30–80; scales Impact 0–4,
Probability 0–4, Severity 0–5; ROLFP 5×3 with Impact_d = column max; phases
Setup → Assets → Review → Triplets → Mitigations → Dashboard → Export.
All suggested/default values are pre-fills; the analyst owns every number that
enters the formula.

## 2. v3.0 → v3.1 deltas (the final requirement set)

1. Asset taxonomy = **CycloneDX 1.6 component types + Service** (PRIVACT canonical);
   external taxonomies crosswalk onto it. Term **"asset type"** replaces
   "asset category" everywhere.
2. Every asset carries **CPE(s)** (BOM `cpe` field or NVD CPE picker).
3. **Asset ↔ vulnerability is automatic** (live CVE query per CPE: NVD primary,
   EUVD, OSV); **asset type ↔ threat is manual** with suggestion pre-fill.
4. Vulnerability **default severity = round(CVSS/2)**, override column per vuln.
   (Supersedes "conservative default 5" and the CWE-catalog/keep-then-map model.)
5. Project **sector** (CISA list) in Setup → relevance badges via CISA ICS CSAF
   advisories; optional default-off filter.
6. Threat library is **multi-source**: MAGERIT v3 (backbone, native CIA) + ENISA +
   NIST 800-30 App.E + ATT&CK ICS + BSI elementary threats + custom; CIA flags
   analyst-assigned (suggested) for non-MAGERIT.
7. Probability **manual** per (threat × asset type × Resides-In), suggestion column
   retained; Resides-In retained.
8. **Scoping screen** (sheet 8a join): rows asset / asset type / threat /
   vulnerability; all in scope by default; filters + bulk.
9. Risk screen: compact rows (asset id · threat id+CIA · probability · vuln
   id+severity · Risk C/I/A/Max) + full-detail popup.
10. Mitigations: **Remediate** (CVE record fix → severity 0) + **Mitigate**
    (CVE→CWE→D3FEND(+OT) chain; effectiveness defaults by tactic: Isolate −3,
    Harden −2, Deceive/Detect −1, Evict/Restore none; analyst override;
    strongest-only composition) → recompute → reduction %.
    (Supersedes the v2 score-multiplicative residual model.)
11. Dropped: project CIA priorities (**C2 ✓**); threat-actor taxonomy (**TA-1 ✓**).
12. Architecture: **client-only source adapters** (direct browser calls, IndexedDB
    cache, keyless default + BYO NVD key, per-source graceful degradation; backend
    is a future swap-in behind the same interface, not a dependency). Tool is
    domain-generic; no case-study data baked in.

## 3. Data model anchors

- `Asset`: + `assetType` (CycloneDX enum value), + `cpes: string[]`, ROLFP,
  `residesIn`. (rename from categoryId)
- `Threat` (library record): id, name, type, ciaFlags{c,i,a}, origin{deliberate,
  accidental}, description, source, sourceAssetTypes (native, where provided).
- `VulnRecord` (normalized, from adapters): cveId, euvdId?, description,
  cvss{score,vector,version}, defaultSeverity, severityOverride?, epss?, exploited,
  sectorTags[], cweIds[], sources[], affectedAssetId.
- `ScopeRow`: assetId, assetType, threatId, vulnId, inScope (default true).
- `Countermeasure`: id, kind: remediate|mitigate, source(D3FEND/CSAF/KEV/NVD/EUVD),
  d3fendTactic?, defaultEffect (severity delta or →0), effectOverride?, appliedTo
  (vulnId).

## 4. GitHub correction plan (state → v3.1)

Current state: branch `v3`, commit A (S3-A threat library) committed. S3-B paste
**cancelled — do not execute**; any uncommitted S3-B work is discarded.

- **Survives as-is / adapts:** S3-A catalog+overlay infra, source picker, threat
  library UI (rename + taxonomy swap + more sources later); all v2 CycloneDX
  import/export adapters (now central); MSW/TanStack/api layering; Setup/Assets/
  Dashboard/Export shells.
- **Dual-field transitional state (from C1a):** `Asset.assetType` (CycloneDX) is
  CANONICAL — all UI / new code reads only this. `Asset.privact.legacyCategory`
  + the v1 applicability matrix (`applicableAssetCategories` seeds, resolver,
  tripletGenerator, Phase-2 filter, heatmap axis, `/catalog/asset-categories`)
  are FROZEN — consumed only by the v1 pipeline, scheduled for retirement at
  C6/C7. New canonical taxonomy served by `/catalog/asset-types` (14 values).
- **Superseded progressively (kept booting until replaced):** v2 applicable-threats/
  vulns Phase-2 screens (→ scoping screen), v2 triplet pipeline inputs (→ new
  per-CPE vulns), v2 mitigations residual model (→ severity-recompute), CWE/ENISA-
  actor catalogs, "category" naming.
- **Docs:** this file replaces v3-blueprint v3.0; `tool-documentation.md` +
  `user-requirements.md` added; `backend-endpoints.md` and `open-questions.md`
  updated per commit as contracts change (vuln-catalog pagination contract is
  dropped — replaced by client adapters note).
- **Export shape changes (C2):** project CIA priorities removed →
  `x-privact:cia.*` dropped from the CycloneDX BOM, `x-privact:project-cia` from
  the OSCAL AR, and `ciaPriorities` from the report-preview metadata. Downstream
  BOM/OSCAL consumers lose those three props; no other export fields change.
- **Threat-actor removal (TA-1 — delta 11):** the ENISA 4-category threat-actor
  model is gone — Setup "Threat Actor Profile" section, `Project.threatActorProfile`,
  per-threat `applicableActors`, the Phase-2 row de-emphasis / chips / filter, the
  Catalog "ENISA Actors" sub-tab, and the `threatActor`/`enisaActorCatalog`
  types+catalog. **Materiality verified before removal:** actors never entered the
  risk formula, applicability, probability, or the `TR-*` triplet id — purely
  display/highlight/filter/export-metadata. **Export shape change:** the OSCAL AR
  `x-privact:threat-actors` per-threat prop is dropped (analogous to C2's
  `x-privact:cia.*`); CycloneDX BOM + report-preview unaffected. Threats are now
  classified by type + deliberate/accidental origin only. Persisted stores
  (`privact_applicable_v5`, project store) keep their keys per the migrate-on-read
  policy — stale `applicableActors`/`threatActorProfile` JSON is simply unread.

## 5. Build sequence (each: pre-screen → paste → Gate 4.5 → commit; end-to-end
stakeholder evaluation after C7–C8)

- **C1 — Taxonomy & terminology.** CycloneDX types canonical; global rename
  category→type (types, endpoints `/catalog/asset-types`, UI, docs); crosswalk
  retargeted; MAGERIT full ~50 backfill (data-prep fallback: user drops PDF).
  - **C1a — BUILT.** Added `device-driver` to the CycloneDX enum (13 types +
    `service` = 14); `Asset.type` → `Asset.assetType`; new `GET
    /catalog/asset-types` + `useAssetTypes` (legacy `/catalog/asset-categories`
    kept frozen for the v1 matrix — additive, not a rename, to avoid breaking
    the frozen v1 heatmap/filter); MAGERIT→CycloneDX crosswalk (`mageritCross
    walk.ts`) surfaced as suggestions in the threat library; dual-field state
    documented. Methodology untouched (v1 matrix frozen, not migrated).
  - **C1b — BUILT.** Full MAGERIT v3 threat catalog (55 entries) parsed from
    `./data-prep/magerit-v3-libro2.pdf` §5, replacing the 14-entry subset.
    Method: pypdf (isolated venv; no poppler/pdftotext available) → structured
    fields (CIA dimensions, asset-type codes, origin) extracted verbatim; names
    + descriptions curated to concise English. 57 source codes − 2 obsolete
    (E.7, E.14). 3 entries hand-corrected for PDF defects (A.3 mislabel, A.4
    mixed dims, A.11 two-column merge). Closes the open-questions backfill entry.
- **C2 — Setup. BUILT.** Removed project CIA priorities (type, Setup UI,
  store + migration shim stripping `cia`/`ciaPriorities`, seed, exports, report,
  phase-gating); added `Project.sector?: CisaSector` (CISA 16, optional, default
  none; Setup single-select; demo-2 = healthcare-public-health). CIA priorities'
  only material consumer — the CVSS-environmental CR/IR/AR auto-default — now
  defaults to Medium (CVSS neutral). Setup completion re-gated on non-empty
  project name. Export shape change: `x-privact:cia.*` (CycloneDX),
  `x-privact:project-cia` (OSCAL), `ciaPriorities` (report-preview) removed.
- **C3 — Assets + CPE + adapter foundation. BUILT.** `Asset.cpes: string[]`
  (replaced the v2 single `cpe?`); BOM import reads `component.cpe` → `cpes[]`,
  empty → "CPE missing" badge; CPE picker (NVD CPE keyword search, multi-select,
  manual cpe:2.3 + validation). CORS task #1 done (matrix in
  `backend-endpoints.md`): NVD keyless GET = `ACAO:*` (works), keyed-header =
  preflight-403 (degrade-to-keyless), OSV ok (C4), EUVD CORS-blocked
  (`enabled:false`, proxy in phase E). Adapter foundation `src/lib/vulnSources/`
  (common interface, `searchCpe` now / `queryByCpe` reserved for C4, per-source
  `enabled`) + `idbCache.ts` (24h TTL) + serialized rate-limit queue + 429/503
  backoff + BYO-key field (`NvdKeyField`). MSW passes through external domains
  (no mock-endpoint change; inventory still 53). NO CVE querying yet (C4).
- **C4 — Vulnerability intelligence.** NVD/EUVD/OSV adapters; normalized records;
  default severity + override; KEV; sector badges (CISA CSAF via GitHub raw);
  per-asset auto-match; progressive sync UI.
  - **C4a — BUILT.** Per-asset CVE match (NVD by `cpeName` + OSV by purl, merged/
    deduped by CVE; shared NVD rate-limit client). Normalized `VulnRecord`
    (CVSS 4.0>3.1>3.0>2.0; `defaultSeverity = round(cvss/2)`; KEV via NVD
    `cisaExploitAdd`; CWEs). Records → IndexedDB (cache-class); analyst
    `severityOverride` → MSW (`PATCH /projects/{id}/vulns/{cveId}/override`,
    +GET map). Progressive "Sync vulnerabilities" UX (sequential, progress + ETA,
    per-asset re-sync, staleness) in a new Review "CVE Intel" tab; per-asset
    table with editable override, KEV badge, sources, pagination, scale rubric;
    EUVD shown disabled. Export round-trip closed: `component.cpe = cpes[0]`
    (+`x-privact:cpes` when >1) + `x-privact:sector`; importer reads them.
    Endpoint inventory 53→55. NO sector badges yet (C4b).
  - **C4b — pending.** CISA ICS CSAF (GitHub raw) → CVE→sector map (IndexedDB)
    → sector relevance badges + optional default-off filter.
- **C5 — Threat side completion.** Additional sources (ENISA, NIST 800-30, ATT&CK
  ICS, BSI) in the library; asset-type↔threat matching matrix (manual + suggestion
  column + per-threat source); probability screen (threat × type × Resides-In,
  manual + suggestion column, inline Threat Scales rubric).
  - **C5a — additional threat sources. PARTIAL.** ATT&CK ICS (79 techniques,
    parsed from the official `mitre-attack/attack-stix-data` STIX bundle) and
    ENISA (180 rows, parsed from the official ENISA Threat Taxonomy xlsx) loaded
    into the library; MAGERIT (55) stays the backbone → 314 total, all
    source-tagged + opt-in in the existing picker. New `CatalogThreat` optional
    fields `tags?` (ATT&CK tactics / ENISA mid-level) + `ciaUnset?` ("needs CIA"
    badge — CIA left unset, analyst assigns in the library editor; cleared on
    edit-save; not in the pipeline until C5b/C5c). origin per source nature;
    `mageritAssetTypes` empty (matching is manual in C5b). **NIST SP 800-30r1
    App.E DEFERRED** (user decision): the PDF is reachable but its two-column
    prose table (E-2 adversarial / E-3 non-adversarial) with full-width
    sub-headers + multi-line cells does not extract faithfully (3 parser attempts
    mis-aligned/mis-counted) — add later via a clean structured CSV/xlsx drop (NO
    silent subset, NOT hand-transcribed). BSI deferred (Q1). See open-questions.
  - **C5b — matching matrix. BUILT.** Project-scoped asset-type↔threat matrix on
    a new Review "Threat Matching" tab: rows = working-set threats grouped by
    source (collapsible) + source-filter; columns = asset types present in the
    project's assets + a "show all 14" toggle; cells toggle a match. Matches
    persist to `/projects/{id}/threat-matches` (GET seeds + PUT replaces) as
    `ThreatMatch{threatId, assetType, provenance, createdAt}` with suggested-vs-
    manual provenance. MAGERIT rows pre-fill from the C1 crosswalk (seeded
    server-side on GET, marked "suggested" (cyan), removable — a `seeded` set
    makes removals stick); ENISA + ATT&CK are manual (teal). **ATT&CK suggestions
    NOT derived** — ICS `x_mitre_platforms` is uniformly "None" (no usable data),
    so ATT&CK stays manual (reported). Bulk-keep-by-source endpoint
    (`POST .../library/threats/bulk`) populates the working set in one call.
    Methodology guard: a matched row whose threat still has `ciaUnset` shows a
    "set CIA" warning (the match contributes 0 to risk until CIA is set).
    Endpoints +3 (55→58). Matched pairs feed the C6 scoping join (not yet the
    triplet pipeline).
  - **C5c-1 — project zones. BUILT.** `Project.zones` seeded from the Purdue/
    ISA-95 reference levels (L0 Process · L1 Basic Control · L2 Supervisory
    Control · L3 Operations · L3.5 DMZ · L4 Enterprise · L5 Internet/Cloud),
    editable in Setup (add/rename/remove per IEC 62443 — owner-defined). Asset/
    Service `residesIn` is now a zone Select (was free-form). Migrate-on-read
    (EB-1 policy, no key bump): a project lacking zones seeds Purdue ∪ its assets'
    (name-mapped) residesIn values — legacy strings map to the nearest Purdue
    zone by name/alias or are preserved verbatim as custom zones (demo-2: 5
    custom zones preserved, none false-matched). `/projects/{id}` carries zones;
    PATCH accepts them. No new endpoints.
  - **C5c-2 — probability matrix. BUILT.** New Review "Probability" tab: rows =
    matched (threat × asset type) pairs from C5b, columns = zones where the
    project has assets of that type (+ "show all zones"). Each cell = heuristic
    suggestion (placeholder) + editable 0-4 override; effective = override ??
    suggestion (feeds the C7 triplet pipeline, not wired yet). Inline Threat
    Scales (0-4) rubric. **Suggestion heuristic (transparent, NOT authoritative):**
    baseline 2; for DELIBERATE threats a Purdue zone-exposure modifier
    (L5/L4 +1 · L3/L3.5 0 · L2/L1/L0 −1, clamp 0-4; custom zones neutral);
    non-deliberate → flat baseline. Labelled heuristic in the UI; ENISA-prevalence
    refinement deferred until ETL data loads (open-questions). Storage
    `/projects/{id}/threat-probabilities` (GET+PUT, sparse — only overrides).
    Endpoints +2 (58→60). ciaUnset "set CIA" warning carried from C5b.
- **C6 — Scoping screen. BUILT.** Dedicated pre-triplet screen at
  `/projects/{id}/scope` (reached via a banner on the Triplets page; the v2
  Review→Triplets footer is left intact — C7 formalizes Review→Scope→Triplets).
  Per asset (collapsible) a threats×CVEs sub-matrix: rows = threats matched to
  the asset's type (C5b) with source · CIA · effective zone-probability (C5c);
  columns = the asset's synced CVEs (C4) with id · effective severity · KEV;
  cells = in-scope toggle. **All in scope by default — only the PRUNED set
  persists** (`/projects/{id}/triplet-scope` GET+PUT), so stickiness is inherent:
  a pruned pair stays pruned, newly-synced CVEs / newly-matched threats auto-enter
  scope. Bulk prune by row (threat × all CVEs) · column (CVE × all threats) ·
  asset; restore-all per asset. **Filters are view-only** (min severity · KEV ·
  threat source · zone) with a "N pairs / M assets hidden — still in scope"
  indicator so filtering is never mistaken for pruning. ciaUnset "set CIA"
  warning carried. Column pagination for CVE-heavy assets. Empty states for
  0 matched threats or 0 synced CVEs. Endpoints +2 (60→62). Pruned pairs feed
  the C7 triplet generation (not wired yet). NOTE: requires the asset's CVEs to
  be synced first (Review → CVE Intel); unsynced assets show "nothing to scope".
- **C6.5 — mandatory CPEs for components. BUILT.** The 13 CycloneDX component
  types now require ≥1 CPE: `componentFormSchema.cpes` is `.min(1)`, so the asset
  form blocks save without one (NVD picker OR a format-valid manual cpe:2.3
  satisfies it; a custom CPE matching zero CVEs is allowed — honest "no known
  vulns", not the dead-end). A CPE-less component is a derived "resolution-required"
  state (`lib/assetCpe.cpeResolutionRequired`, never stored/data-lossy): existing
  CPE-less assets are flagged "CPE required — resolve" in the Assets table and the
  Scope screen, not deleted; BOM-imported CPE-less components import + flag the
  same way (the C3 "CPE missing" badge). **Service (14th type) is EXEMPT** — a
  separate entity with no CPE by nature: a "Service · no CVE" note in Assets, an
  info Alert in the service form, and a Scope-screen note list it as no-triplet-
  risk. Service threat-matches (C5b) stay allowed but are informational only
  (no vuln → no triplet) — documented in open-questions. No endpoint change.
- **C7 — Triplets + Risk.** New pipeline wired end-to-end; compact rows + popup;
  v2 Phase-2/3 screens retired.
- **C8 — Mitigations. BUILT.** Vuln-instance-anchored (one row per asset×CVE
  from the C7 live pipeline). **Remediate** (→ residual severity 0, dominates) +
  **Mitigate** (D3FEND countermeasures, effectiveness defaults by tactic
  Isolate −3 / Harden −2 / Deceive·Detect −1 / Evict·Restore·Model 0, analyst
  override [-5,0], STRONGEST-ONLY composition). Residual acts on the Severity
  factor only — `computeRiskV3` re-run with `severity → residualSeverity`;
  kernel (impact/applicability/probability/scales/bands) INVARIANT. Per-triplet
  reduction% + project score-mass aggregate (em-dash on empty denominator) +
  band-shift deltas, all recomputed live. **D3FEND data layer = bundled snapshot
  (v1.4.0, 2026-03-31)** generated offline (`data-prep/d3fend/` → `src/lib/d3fend/
  d3fendSnapshot.ts`, generated-data seed): 271-technique tactic-grouped catalog
  (picker universe) + a faithful SPARSE CWE→technique overlay (10 CWEs — D3FEND
  exposes no broad client-derivable CWE→countermeasure mapping and no per-CWE
  live route, so snapshot-only ships; live stubbed behind the SourceAdapter
  interface, EUVD pattern). New store `privact_mitigations_v3` (migrate-on-read,
  no key bump) + `GET/PUT /projects/{id}/mitigations-v3` (62→64). CWE ids already
  persisted on CVE records since C4a (no adapter change; defensive `?? []` read
  guard added). **v2 multiplicative residual + v2 mitigation panel retired on
  THIS route only** — still consumed by Dashboard/Export/oscalAdapter (material-
  consumer STOP verified), full audit/retirement deferred to C9.
- **C9 — Dashboard/Export adaptation + cleanup** of superseded paths + docs sweep.
  - **C9b — Export → v3 + generation stamp. BUILT.** Report preview + JSON +
    PDF + XLSX + CycloneDX 1.6 + OSCAL 1.1.2 all read the LIVE v3 model
    (client-side, via the shared `useResidualModel`), so the report summary
    equals Dashboard equals Mitigations (parity test extended). Downloads are
    generated in-browser (`clientDownloads`); PDF/XLSX keep the placeholder-doc
    generation; JSON = the v3 preview serialized. **Native-construct-first
    mitigation mapping:** CycloneDX — REMEDIATE → `vulnerabilities[].analysis.
    state=resolved` + `response:[update]`; D3FEND-MITIGATE → still-affected
    `state=exploitable` + `response:[workaround_available]` + detail + `x-privact:
    mitigation`/`x-privact:residual-severity` (never "resolved"). OSCAL — REMEDIATE
    → `risk.remediations[]` lifecycle `completed` + `risk-status:closed`;
    D3FEND-MITIGATE → `mitigating-factors[]` + `risk-status:remediating` (risk
    remains); residual → characterization facets; residual-High → finding;
    applicability overrides → EXAMINE observations (kept). **Generation stamp**
    (`ReportProvenance`) embedded natively in every format (CycloneDX metadata +
    properties, OSCAL metadata props, JSON field, PDF/XLSX section) + a preview
    provenance panel: generatedAt, project, methodology v3.1, tool build SHA,
    scope **state-hash** (v3 scope pruning doesn't bump scopeVersion — flagged),
    versioned standards (D3FEND 1.4.0 partial, CWE/CVSS, MAGERIT/ENISA/ATT&CK
    ICS), and a live CVE **as-of** (cache lastSynced). Offline validity checks +
    parity test pass. NO new endpoints (client-side); the v2 export handlers/
    hooks + downloadHelpers are now dead but LEFT IN PLACE (C9c). New type fields
    (CycloneDX `analysis`, OSCAL `remediations`/`risk-status`) are additive.
  - **C9a — gating + Dashboard → v3 live. BUILT.** Completion-gating repointed to
    a LIVE predicate (`derivePhaseStatuses(project, {hasTriplets})`): Triplets/
    Mitigations/Dashboard/Export light once ≥1 in-scope, CVE-resolved triplet is
    derivable (mitigation optional); Setup/Assets/Review keep count-based logic;
    no `computedAt`/`computedScopeVersion`/staleness. PhaseNav now reads
    `useLiveTriplets` (drops `useRiskSummary`). Dashboard reads LIVE from a SHARED
    residual model (`useResidualModel`, extracted from the C8 Mitigations
    view-model so both screens use the SAME aggregate): KPIs (total · coverage ·
    score-mass reduction% · high orig→residual), heatmap assetType×threatType
    (`buildHeatmapV3`, original/residual toggle, drill → Triplets via
    `?asset_type=&threat_type=` slugs), top-residual repointed to the v3 residual,
    v3 empty state (resolve CPEs / check Scope — NOT "compute"). Reduction% +
    band counts come from the shared aggregate; `formatReductionPct` shared by the
    Dashboard KPI and the Mitigations header (parity test asserts they match). NO
    new endpoints (pure client derivation; v2 dashboard handlers left in place).
    **No v2 module removed** (material-consumer STOP — Export/C9b/C9c still need
    `residualComputation`, the v2 mitigation store, `/triplets/:tid/mitigations`,
    OSCAL adapter). C9b = Export → v3; C9c = retire v2 modules.
  - **C9c — cleanup / deletion. BUILT.** Retired the dead v2 paths left in place
    by C9a/C9b. (1) **Relocated** the 3 CycloneDX builders (`assetComponent`,
    `serviceEntry`, `linkDependency`) out of the deleted v2
    `lib/cyclonedxAdapter.ts` into a new shared `lib/export/cyclonedxComponents.ts`;
    `lib/export/cyclonedxV3.ts` imports them from there. (2) **Split**
    `lib/export/oscalV3.ts` (was 230, over the 220 soft cap) → converters
    (`tripletToRiskV3`, `tripletToFindingV3`, `overrideObservation`, the `p` prop
    helper) extracted to a new sibling `lib/export/oscalV3Entities.ts`; oscalV3.ts
    now ~90 lines. (3) **Deleted 20 orphaned v2 modules** (zero importers,
    reverse-import verified): lib `cyclonedxAdapter`/`oscalAdapter`/`downloadHelpers`/
    `actionFilter`; handlers `exports`/`dashboard`/`mitigations` (de-registered from
    `handlers/index.ts`); api `reports`/`reportsHooks`/`dashboard`/`dashboardHooks`/
    `mitigations`/`mitigationsHooks`; components `MitigationsPanel`(+Header),
    `MitigationsBulkPickerModal`, `StalenessBanner`, `CatalogItemRow`,
    `MitigationDetailModal`, `standards/ActionFrameworkFilters`. (4) **KEPT
    (blocked):** `lib/residualComputation.ts` + `mocks/data/mitigationStore.ts` are
    STILL imported by the v2 triplet pipeline (`tripletStore`, `handlers/triplets`/
    `imports`/`applicabilityOverrides`, still MSW-registered, out of C9c scope) — per
    the reverse material-consumer STOP rule they cannot be deleted yet; their
    retirement is now blocked on retiring the v2 triplet pipeline (deferred to a
    future commit / phase E). (5) **Endpoint recount 64→52** (−12): Export 6
    (`report-preview`, `report.{json,pdf,xlsx}`, `report.cyclonedx.json`,
    `report.oscal.json`), Dashboard 2 (`risk-heatmap`, `risk-summary/top-residual`),
    Mitigations 4 (`GET`+`PATCH /triplets/:tid/mitigations`, `mitigations/picker`,
    `mitigations/bulk`). (6) **NIST/CIS kept as REFERENCE** — `nistCatalog`/
    `cisCatalog` + the /catalog NIST and CIS sub-tabs stay live; a "Reference only —
    not wired into risk scoring" Alert was added to /catalog when NIST or CIS is
    selected. The /catalog NIST/CIS view renders via `components/catalog/CatalogTreeView`
    + `lib/catalogNodes` + `lib/catalogFrameworkConfig` (NOT FrameworkBreadcrumb/Tree);
    `standards/FrameworkBreadcrumb.tsx` + `standards/FrameworkTree.tsx` are now
    orphaned (only used by the deleted v2 mitigation UI) but RETAINED per the explicit
    C9c "keep FrameworkBreadcrumb/FrameworkTree" directive. (7) **UI polish:**
    Mitigations header shows a Low band-shift badge (`lowOriginal`/`lowResidual` added
    to `ResidualAggregate`); the Mitigations table row action renamed "Mitigate" →
    "Plan"; the D3FEND picker labels 0-effect tactics (Evict/Restore/Model) as "0
    effect — documentation only". No v2-only test files existed to remove (all 3 are
    v3: mitigationDraft, residualParity, exportValidity).
  - **C10 — v2 triplet pipeline retired. BUILT (2 commits).**
    **C10a:** `PUT /applicability-overrides` made **store-only** — dropped the
    inline `generateTripletsForProject` + `tripletStore.setComputed` regen. That
    regen was the last live route into the v2 cluster; its v2 triplets were never
    read by any v3 surface (behaviorally inert for v3 risk). The override still
    persists + bumps scope version, and the client hook's project-scoped
    invalidation still re-reads it into the v3 OSCAL export's
    `x-privact:applicability-overrides` metadata — the only v3 consumer of
    applicability overrides (they never fed v3 RISK numbers; v3 in/out-of-scope is
    the separate scope-pruning model `useTripletScope`). Touch-ups: response shape
    dropped `computedAt`/`tripletCount`; `PerAssetApplicabilityTab` "Save &
    recompute" → "Save overrides" copy. **C10b:** with zero live routes left,
    deleted **14 orphaned modules** — `lib/tripletGenerator`,
    `lib/residualComputation`, `mocks/data/{tripletStore,mitigationStore,
    envOverrideStore}`, `mocks/handlers/triplets` (+ 5 endpoints: `GET /triplets`,
    `GET /triplets/:tid`, `GET /risk-summary`, `POST /compute`,
    `PATCH /triplets/:tid/env-override`), `api/triplets`/`tripletsHooks`,
    `components/TripletDetailModal`, and the `components/cvss/` env-override cluster
    (`CvssEnvironmentalSection`/`CvssEnvironmentalEditor`/`CvssComparisonBadges`/
    `ModifiedBaseMetricsForm`/`SecurityRequirementsForm`). KEPT: `lib/cvssEnvironmental.ts`
    (live via `vulnSources/cvssScore.ts`), the `applicabilityOverrides` handler +
    store, the `Triplet`/`CvssEnvironmentalOverride` types. Untouched v3:
    `mitigationV3Store`, `residualRiskV3.ts`. Endpoints 52 → 47. Gate green
    (tsc/eslint/build/19 tests; bundle effectively flat — deleted code was already
    tree-shaken / tiny). Reverse-import: zero non-comment importers of any deleted
    module.

## 5b. UI commits (cross-cutting, interleaved with C-series)

- **UI-1 — Fluid layout. BUILT.** Single page-width primitive
  `src/components/PageContainer.tsx` (`variant="data"` = fluid, no max-width;
  `variant="form"` ≈ 900px). Every page's MAIN content routed through it: data
  = Review, Triplets, Dashboard, Export, Catalog, Assets, Mitigations, project
  list, Placeholder; form = Setup, project overview. Login stays bespoke
  (outside AppLayout). Transient loading/error sub-states keep their centred
  `<Container size="sm">` by design. Future screens inherit by using
  PageContainer.

## 6. Open items (resolve inside the relevant commit)

- CORS posture of NVD / EUVD (C3 task #1) and per-source fallback wiring.
- BSI elementary-threats availability/version verification (C5).
- Exact Resides-In value set (C5).
- OWASP-tagging of threats/vulns where still wanted (post-C5 decision).
- CPE assignment for BOM components lacking a `cpe` field (purl→CPE heuristic or
  picker prompt — C3 decision).
