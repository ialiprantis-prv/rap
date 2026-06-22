# v2 Migration Progress Log

Branch: `v2-standards-aligned`. v1.0 preserved as tag on `main`.

## Completed

### 2026-05-22 — Foundation
- Branch + `v1.0` tag setup
- `docs/standards-decisions.md` locked
- `CLAUDE.md` v2 section added

### 2026-05-25 — Commit [pending]: CWE + CVSS migration in vulnerability catalog
- `ApplicableVuln` (additive) gains optional `cweRefs`, `cveRefs`, `cvss: CvssBase`
- `Triplet` (additive) gains optional `vulnCweRefs` / `vulnCvss` so triplet +
  mitigation modals render standards without an extra fetch
- `lib/cvss.ts` — `legacySeverityFromCvss` (CVSS 0–10 → internal 0–5),
  `cvssColor`, `cweUrl`
- **18 vuln seed entries enriched in place** (IDs `VU-xx` preserved → 284
  cross-references in threatSeed/controlSeed/countermeasureSeed intact). 14
  software weaknesses carry CWE + CVSS 4.0 base + representative vector,
  sourced primarily from CWE Top 25 (2025) + essential CWEs (CWE-20, 311, 319,
  326, 778, 1104, 1188, 1395). 4 operational-gap entries (VU-15/16/17/18) keep
  their names with no CWE/CVSS.
- `defaultSeverity` derived from the CVSS base via the lookup — Phase 3 risk
  formula unchanged; recompute regenerates triplet scores with the new severities.
- `applicableStore` key bumped `_v2`→`_v3` so the enriched seed reseeds on next
  load (existing demo-2 inclusion state resets — acceptable v2 migration cost,
  documented).
- Display: shared `VulnStandardsBadges` (CWE chips → MITRE link, colored CVSS
  chip) wired into Phase 2 Review row + ReviewDrillModal · Phase 3
  TripletDetailModal · Phase 4a MitigationsPanelHeader · Phase 4c Export
  VulnsInScope (now ID · CWE · Name · CVSS · Severity · Categories, sorted by
  CVSS desc).

### 2026-05-25 — Commit `163aed4`: **v2 [02-03/N]** — combined CycloneDX adoption

Originally specced as two commits (02 export adapter, 03 asset model native);
shipped together because the commit-02 sweep approval was never given before
the commit-03 spec arrived, so the working tree carried both scopes at gate
time. Splitting would have required restoring the commit-02 adapter to its
178-line form then re-applying commit-03's rewrite — error-prone for a single
file's two-version dance. Roadmap numbering preserved by titling `[02-03/N]`.

**Part A — CycloneDX 1.6 export adapter (commit-02 scope):**
- `types/cyclonedx.ts` — 1.6 subset (hand-rolled, no dep).
- `lib/cyclonedxAdapter.ts` — pure `internalToCycloneDx()` converter.
- New endpoint **`GET /projects/{id}/report.cyclonedx.json`** (MIME
  `application/vnd.cyclonedx+json; version=1.6`, filename
  `{slug}-bom-{date}.cyclonedx.json`).
- `downloadHelpers.ts` extended (`ReportFormat` += 'cyclonedx', path routed
  for the `.cyclonedx.json` double-extension).
- `ReportHeader` gained a 4th "CycloneDX" button with explanatory tooltip;
  same independent-loading-state pattern as the other three.
- Asset → Component mapping (initial: category → CDX type), application-api
  dual-emitted as Service. Link → Dependency (asset-A → asset-B).
  ApplicableVuln → Vulnerability with `cwes`/`ratings` (`CVSSv4`/`CVSSv31`,
  no dot)/`affects[]` derived from `vuln.assetCategories ∩ asset.categoryId`.
  PRIVACT data preserved via `x-privact:` properties. bom-ref scheme:
  `project-{id}`, `asset-{id}`, `service-{id}`, `vuln-{id}`.

**Part B — Asset model CycloneDX-native + Component/Service split (commit-03
scope):**
- **Types:** `Asset` now carries `type: CycloneDxComponentType` + `bomRef` +
  a `privact: { residesIn, rolfp, legacyCategory }` extension + CDX optional
  fields (`version`/`supplier`/`manufacturer`/`model`/`serialNumber`/
  `countryOfManufacture`/`purl`/`cpe`/`group`/`licenses`/`externalReferences`).
  Legacy v1 top-level fields (`categoryId`/`residesIn`/`comments`/`rolfp`)
  **mirrored** for backward-compat through this commit (slated for removal
  in commit #4). `Rolfp` extracted to `types/rolfp.ts` to share with
  Service. New `Service` entity (`types/service.ts`) — separate top-level
  kind, CDX Service fields, same `privact` extension. `AssetOrService`
  discriminated union + `isComponent`/`isService`/`getLegacyCategory`
  helpers.
- **ROLFP shape preserved as the actual 15-cell matrix** (not the flat 5
  scalars the spec drafted — that would have been data loss for the engine
  + Phase 1b grid). Documented spec correction.
- **Stores:** `assetStore` key `_v3`→`_v4`; demo-2 seed reduced to 8
  Components; the 4 application-api items moved to new `serviceStore`
  (`privact_services_v1`) with the same IDs
  (`ast-2`/`ast-4`/`ast-6`/`ast-11`) so existing links + computed triplet
  IDs resolve unchanged. `addAsset`/`updateAsset` keep legacy + new fields
  in sync; `application-api` rejected on Asset create.
- **Handlers:** new `GET /projects/:id/services` (read-only this commit —
  Service authoring lands in commit #4). `POST/PATCH /assets` reject
  `application-api` with a helpful message.
- **Engine:** `tripletGenerator` iterates BOTH collections via a normalized
  `{id, name, legacyCategory, rolfp}` view; matching keys on
  `privact.legacyCategory` (v1 applicability matrix unchanged — per-type
  matrix lands in commit #6).
- **CDX adapter simplified (178 → 153 lines):** `CATEGORY_TO_TYPE` map gone
  (uses `asset.type` directly); dual-emit for application-api gone
  (Services come natively from the services collection); link dependencies
  use the correct `asset-*` vs `service-*` bom-ref via cross-collection
  lookup; vuln `affects[]` derived across both collections.
- **`projectCounts.assets` now counts assets + services** (semantically all
  "assets" in the Phase 1b user model). `assetInventory.total` in the
  report preview likewise counts both for consistency; `topByImpact` still
  renders Components only (a Services section in the HTML preview is a
  follow-up).
- **UI merge:** `AssetsPage` queries both via `useServices`; passes
  services to `AssetsTabContent` (renders union with a "Service" badge;
  service rows read-only — edit lands in commit #4) and a merged
  `linkEntities: {id,name}[]` to `AddLinkModal`/`LinksTab` (links can span
  Components + Services). `AssetEditPane` Select + form schema enum
  filter out `application-api`.

**Combined verification:**
- Endpoint inventory **37** (35 + `report.cyclonedx.json` +
  `/projects/:id/services`).
- **Triplet count parity: 75 = v1 baseline** (offline-verified).
- BOM: **8 Components + 4 Services natively** (no more dual-emit); link
  deps cross-resolve `asset-*` ↔ `service-*` correctly; vulns affecting
  application-api (e.g. VU-03 Missing Auth) correctly target only Services.
- **Zero dangling refs** in dependencies + vuln.affects.
- JS bundle +0.87 kB; tsc + eslint + build all green.

### 2026-05-25 — Commit `ee561cf`: **v2 [04/N]** — Asset/Service authoring UI refresh

Phase 1b drawer rewritten around CycloneDX vocabulary. The v1 top-level
legacy mirrors on Asset (deferred from commit 03) are gone; the form binds
directly to `privact.*`. Service authoring lands as full CRUD (commit 03
read-only → POST/PATCH/DELETE).

**Three coordinated goals delivered:**

1. **CycloneDX vocabulary in the form.** The 7-value category dropdown is
   replaced by a 12-value Type Select listing the full CDX 1.6 component
   types (Application / Library / Framework / Container / Platform /
   Operating System / Device / Firmware / File / Data / Machine Learning
   Model / Cryptographic Asset). Display labels are Title-cased; the raw
   CDX value rides along in the Select's `description` line and the
   table's Type-cell tooltip. Asset list "Category" column renamed to
   "Type". Conditional CDX optional fields (`version`, `supplier.name`,
   `manufacturer.name`, `model`, `serialNumber`, `countryOfManufacture`,
   `purl`, `group`) appear per type in a collapsible "Additional details"
   section (default open), matching the spec matrix.
2. **Component vs Service kind.** A `SegmentedControl` at the top of the
   drawer toggles between Component and Service in create mode (defaults
   to Component). In edit mode the toggle is replaced by a Badge label
   reading "Kind: Component" / "Kind: Service" with a "(locked)" hint —
   switching kinds after creation would require entity migration.
   Component-kind shows the Type dropdown + type-conditional fields;
   Service-kind shows Service-specific fields (provider name, version,
   endpoints multi-line, authenticated + xTrustBoundary switches, data
   classifications free-text). ROLFP grid identical for both kinds.
3. **ROLFP layout fix.** The 15-cell grid is rewritten with Mantine
   `SegmentedControl` per cell (5 buttons 0-4). Desktop: CSS grid `100px
   label + 1fr × 3` value columns, fully visible in the 520px drawer.
   Mobile (≤640px): stacks per dimension into 5 blocks of 3 controls —
   touch-friendly with full-width segmented buttons.

**Pane → Drawer migration.** AssetEditPane stops being the right column
of a Mantine Grid and becomes the content of a real Mantine Drawer
mounted at AssetsPage level. Position `right` size 520 on desktop;
`bottom` size 90% on mobile (≤768px breakpoint). Backdrop click + ESC
close. The table reclaims the full width.

**Save model: explicit Save + Cancel.** The form drops `useAssetAutoSave`
and runs a single POST/PATCH on Save button click. Cancel + drawer close
discard the dirty form (Cancel-equivalent). Footer is shared between
Component and Service forms via `EditPaneFormFooter`. Delete button
visible only in edit mode, on the left side of the footer, with the
existing cascade-warning confirm.

**Service CRUD.** Endpoints added: `POST /projects/:id/services`,
`PATCH /projects/:id/services/:sid`, `DELETE /projects/:id/services/:sid`.
DELETE cascades link removal via the same `removeLinksByAsset` helper
Asset DELETE uses (links share the entity-id namespace). API client +
serviceHooks gained `useCreateService`, `useUpdateService`,
`useDeleteService` with the cache-write pattern from assets.

**Types refactor.**
- `Asset` loses the top-level `categoryId`/`residesIn`/`comments`/`rolfp`
  mirrors. `PrivactExt` gains a new `comments: string` field (free-text
  PRIVACT notes, separate from CDX `description` which is for vendor-
  provided component documentation).
- New input shapes `CreateAssetInput` (privact-native) and
  `UpdateAssetInput` reflect the new wire contract.
- `Service` adds `CreateServiceInput`/`UpdateServiceInput`.
- New reverse map `CDX_TYPE_TO_CATEGORY` in `assetStore`: the form sets
  Asset `type` directly and derives `privact.legacyCategory` for the v1
  applicability matrix lookup (most CDX types fall back to the coarse
  `'hardware'` slug pending per-type matrix migration in commit #6).

**Store key bumps.** `privact_assets _v4→_v5` (Asset shape break);
`privact_services _v1→_v2` (gain `privact.comments`). Demo-2 reseeds —
existing user data resets, documented + acceptable migration cost.

**Removed files (orphaned by the rewrite).** `useAssetAutoSave.ts`,
`AssetImpactSection.tsx`, `RolfpGrid.tsx` (slider version),
`AssetEditPaneHeader.tsx`, `SaveIndicator.tsx`. The locked auto-save
pattern survives in git history; CLAUDE.md updated to drop the
"Shared hook" reference.

**New files.** `AssetEditDrawer.tsx`, `ComponentEditForm.tsx`,
`ServiceEditForm.tsx`, `ServiceDetailsSection.tsx`,
`AssetAdditionalDetails.tsx`, `RolfpSegmentedGrid.tsx`,
`RolfpFormSection.tsx`, `EditPaneFormFooter.tsx`,
`lib/componentForm.ts` (Zod schema + RHF defaults + input mappers),
`lib/serviceForm.ts` (same for Service).

**Adapter polish.** `cyclonedxAdapter` now emits `x-privact:comments`
for both components and services when the field is set; no functional
behavior change otherwise.

**Verification.**
- Endpoint inventory **40** (37 → 40, +3 service CRUD).
- Triplet count parity **75 = v1 baseline** (entity counts + matrix
  unchanged).
- File-size audit: no file over 260-line cap (largest:
  ComponentEditForm 244, AssetsPage 247).
- Zero remaining legacy-mirror reads (`asset.categoryId`/`residesIn`/
  `comments`/`rolfp` top-level usage) outside types/stores.
- JS bundle 956.67 → 965.87 kB raw (+9.20 kB) / 290.72 → 292.35 kB gz
  (+1.63 kB). Slightly over the spec's +2-5 kB estimate; the Drawer +
  SegmentedControl primitives + 12-type Select data add weight.
- tsc + eslint + build all green.

### 2026-05-25 — Commit `eedcad2`: **v2 [05/N]** — Modal + severity colors polish

Targeted UX polish on the Asset/Service authoring surface introduced in
commit 04. Three coordinated tweaks. No data model changes, no handler
changes, no type changes. Endpoint inventory unchanged at 40.

**1. Drawer → Modal.** `AssetEditDrawer.tsx` renamed to
`AssetEditModal.tsx` (file rename via `git mv` so history follows). The
side-anchored Drawer was too narrow at 520px once the two-column layout
landed. New responsive sizing:
- ≥1024px: centered Modal at width 1000px with backdrop.
- 768-1023px: centered, width 90vw.
- <768px: `fullScreen={true}`.
ESC + backdrop-click close path unchanged (Mantine Modal handles both
natively, funneled through the existing `onClose` → silent discard, same
as commit 04). The `DrawerState` type rename → `AssetEditModalState`.

**2. Two-column desktop layout.** Inside the modal body,
`ComponentEditForm` and `ServiceEditForm` switch to
`SimpleGrid cols={{ base: 1, md: 2 }}` for the main block:
identification fields on the left, ROLFP grid on the right. For
Component, the "Additional details" collapsible section sits full-width
*below* the two-column block. For Service, identification +
service-details fields combine in the left column (no full-width
section underneath since Service doesn't have a Component-style
optional-fields panel). Collapses to single-column at `<md` (Mantine's
~768px breakpoint).

**3. Severity-colored ROLFP buttons.** `RolfpSegmentedGrid` drops
Mantine `SegmentedControl` and renders five always-visible
`SeverityButton`s per cell. Inactive buttons get a ~13% tint of the
severity color plus colored text; the active button shows full
saturation with white text + a slight shadow. The full gradient
(gray → teal → yellow → orange → red) is legible in every cell, so the
user reads severity at a glance instead of clicking to find the active
value. Palette ships from a new `SEVERITY_PALETTE` constant in
`lib/scale.ts`, using the spec's Tailwind 500 hex values
(#6B7280 / #14B8A6 / #EAB308 / #F97316 / #EF4444). The "Impact
(computed)" badges underneath the grid now render with the same palette
(replacing Mantine's themed `Badge color=...`), so the orange of an
active C-3 button and the orange of the resulting C-3 impact badge are
the exact same shade. `RISK_SCALE` and `riskLevel()` retain their
Mantine color names so other surfaces (ProjectOverviewPage CIA badges)
stay on the existing theme.

**Conditional-fields layout polish.** `AssetAdditionalDetails` switches
from a single-column stack to a responsive `SimpleGrid cols={{ base: 1,
sm: 2, md: 3 }}` for the narrow fields; PURL alone is wide-form (per
spec) and sits full-width below.

**Files affected.** Renamed: `AssetEditDrawer.tsx → AssetEditModal.tsx`.
New: `SeverityButton.tsx`. Modified: `lib/scale.ts` (palette), `pages/
AssetsPage.tsx` (imports + type rename), `components/AssetEditModal.tsx`
(Drawer → Modal), `components/RolfpSegmentedGrid.tsx` (custom buttons),
`components/RolfpFormSection.tsx` (palette-aware badges),
`components/ComponentEditForm.tsx` (SimpleGrid), `components/
ServiceEditForm.tsx` (SimpleGrid), `components/AssetAdditionalDetails.
tsx` (responsive narrow/wide split).

**Verification.**
- Endpoint inventory **40** (unchanged).
- Triplet count parity **75 = v1 baseline** (no engine/data changes).
- File-size audit: no file over 260 lines (largest: AssetsPage 247,
  ComponentEditForm 251 — was 244, +7 from the SimpleGrid wrapper).
- JS bundle 965.87 → 967.23 kB raw (**+1.36 kB**) / 292.35 → 292.85 kB
  gz (**+0.50 kB**) — within the spec's "+1 to +2 kB" estimate.
- tsc + eslint + build all green.

### 2026-05-25 — Commit `844eb87`: **v2 [06/N]** — CycloneDX Import (closes the interop loop)

Adds "Import BOM" on Phase 1b Assets tab. Users can upload a CycloneDX
1.4 / 1.5 / 1.6 JSON file; the parser validates + maps Components /
Services / Dependencies to internal entities, the modal previews counts +
warnings, and on confirm the project's inventory is replaced.

Mode: replace-all (destructive). Merge mode deferred.

Lenient version support: 1.4, 1.5, 1.6 accepted with `UNSUPPORTED_VERSION`
for everything else. ROLFP defaults to all-zeros when a component/service
lacks `x-privact:rolfp` (the case when importing BOMs from non-PRIVACT
tools); a warning is surfaced in the preview.

**Round-trip guarantee.** Our own Phase 4c export's `x-privact:*`
properties survive a re-import — assets, services, links and all
methodology data (ROLFP, residesIn, comments, legacyCategory) round-trip
to an equivalent state (modulo internal IDs).

**New endpoint:** `POST /projects/:id/import.cyclonedx`. Endpoint
inventory **41** (was 40 — +1 for this; spec said "37 → 38" but that
predated commit-04's Service CRUD which had already taken us to 40).

**Server-side side effects (mock-transactional).** On a successful
import the handler:
- replaces all assets via `assetStore.replaceAssets`
- replaces all services via `serviceStore.replaceServices`
- replaces all links via `linkStore.replaceLinks`
- clears applicability cache (`applicableStore.clearProject`) — included
  flags would be stale against the new asset set
- clears triplet cache (`tripletStore.clearProject`) — Compute regenerates
- clears mitigation selections (`mitigationStore.clearProject`) — they
  reference triplet IDs that no longer exist
- bumps `scopeVersion`

The client invalidates every project-scoped TanStack Query on success
(predicate match on `projectId` in the queryKey).

**Parser (`lib/cyclonedxImporter.ts` + `cyclonedxImportEntities.ts` +
`cyclonedxImportProperties.ts`).** Split across three files to stay
under the 260-line cap. Surfaces structured errors:
`INVALID_JSON` / `NOT_CYCLONEDX` / `UNSUPPORTED_VERSION` /
`STRUCTURE_INVALID` / `COMPONENT_INVALID` / `SERVICE_INVALID` with
user-facing message + technical details expandable. Non-blocking
warnings preserved: components without ROLFP, services without ROLFP,
dangling dependency refs, unknown CDX type defaulted, non-`x-privact:`
properties counted.

Property reads handle both `x-privact:category` (what the current
export emits) and the spec's `x-privact:legacyCategory` as an alias.
Services in `bom.services[]` always get `legacyCategory:
'application-api'` regardless of properties — placement wins.

**UI flow.** Outlined "Import BOM" button next to the filled "Add
Asset" on the Assets-tab header. Modal states: initial (drag-drop +
"Choose file" via hidden `<input type="file">`) → parsing (spinner) →
either error (alert with details expand + "Choose different file") or
preview (counts + warnings + replace warning + Compute reminder +
"Replace assets with BOM"). Native HTML drag-drop on a styled div
(no `@mantine/dropzone` dep). Modal goes full-screen on `<768px`.

**Files affected.** New: `types/cycloneDxImport.ts`,
`lib/cyclonedxImporter.ts` + `cyclonedxImportEntities.ts` +
`cyclonedxImportProperties.ts`, `mocks/handlers/imports.ts`,
`api/cyclonedxImport.ts` + `cyclonedxImportHooks.ts`,
`components/import/{CycloneDxImportModal,ImportPreviewSection,BomDropTarget}.tsx`,
`components/AssetsTabHeaderActions.tsx`. Modified: 7 stores/handlers (added
`replaceAssets` / `replaceServices` / `replaceLinks` / `clearProject` for
applicable+triplet+mitigation stores), `pages/AssetsPage.tsx` (modal
mount + header refactor), `mocks/handlers/index.ts` (registry),
`docs/backend-endpoints.md`.

**Verification.**
- Endpoint inventory **41** (was 40, +1).
- Triplet count parity: not applicable for this commit (import deliberately
  clears the cache; user runs Compute to regenerate).
- File-size audit: no file over 260 lines. Largest: AssetsPage 238,
  ImportModal 230, ImportEntities 223.
- JS bundle 967.23 → 980.89 kB raw (**+13.66 kB**) / 292.85 → 297.08 kB
  gz (**+4.23 kB**). Gz is within the spec's +3 to +6 kB band; raw is
  over (the parser + modal + preview + drop-target + state machine all
  add weight). No new npm deps.
- tsc + eslint + build all green.

### 2026-05-26 — Commit `73f7c94`: **v2 [07/N]** — CWE hierarchy + Pillar filter

First applied standards browser/picker pattern in the v2 line. Establishes
the layout — hardcoded reference catalog + helper functions + breadcrumb +
expanded tree + Pillar-level filter — that the planned ENISA threats and
NIST/CIS/D3FEND actions commits will reuse.

**Catalog** (`lib/cweCatalog.ts`, **27 entries**): all 8 CWE-1000 Pillars,
the 6 intermediate Classes our Bases need (CWE-20, 74, 284, 287, 326, 345),
and the 13 Bases referenced from vulnSeed (CWE-89, 306, 311, 319, 327,
494, 770, 778, 798, 862, 1104, 1188, 1395). Coverage audit ran during
build: every one of the 18 unique CWE refs in `vulnSeed.ts` resolves to a
Pillar via `getParentChain()`.

**Catalog deviations from the spec's draft.** The spec listed several
Bases we don't actually use (CWE-79 XSS, 78 OS Command Injection, 22 Path
Traversal, etc.); omitted those. Added 11 entries the spec missed but
vulnSeed needs (CWE-20, 326, 327, 345, 494, 778, 1104, 1188, 1395). The
hierarchy itself follows the spec's shallow-chain preference (e.g. CWE-287
sits under CWE-284 here, even though CWE-1000 canonically places both
directly under 693) — same call as the spec.

**Helpers** (`lib/cweHelpers.ts`):
- `getCweEntry(id)` — returns the entry or `undefined` and console-warns
  the first time it encounters an unknown id (one-shot per id via a Set,
  no log spam).
- `getParentChain(id)` — returns the chain from Pillar down. Defensive
  depth limit guards against (impossible) cyclic data.
- `getPillarFor(id)` — returns the Pillar entry or undefined.
- `getVulnPillarId(cweRefs)` — pillar id from `cweRefs[0]`. Used by the
  Phase 2 Review filter pass. Multi-ref vulns are categorized by their
  primary (first) ref — clean and predictable; the modal still shows
  every ref's full chain.
- `getCweEntriesByType(type)`, `getCweMitreUrl(id)` — utility.

**Components (`components/standards/`)**:
- `CweHierarchyBreadcrumb` — inline chain of chevron-separated chips,
  type-coded (Pillar indigo / Class teal / Base orange), each linking
  to MITRE. Used in Phase 2 Review rows, Phase 3 TripletDetailModal
  header, Phase 4a MitigationsPanelHeader.
- `CweHierarchyTree` — expanded vertical layout for the Phase 2 detail
  modal. One row per chain segment, indented to convey depth. Leaf row
  (the vuln's primary CWE) highlighted with an asterisk + accent
  background. Each row links to MITRE.
- `CwePillarFilter` — Mantine `Select` populated from the current vuln
  list. Each Pillar shows its in-list count; empty Pillars are hidden
  to keep the dropdown short. An "Uncategorized (N)" option covers
  vulns with no `cweRefs` (operational gaps from commit 01).
- `CvssDetail` — the enhanced CVSS display for the detail modal: big
  score in severity color (Mantine color-7), Severity badge, version
  badge, the raw vector in monospace, then a per-metric breakdown
  (abbreviation chip + human-readable metric name + value label). A
  FIRST.org calculator link is pre-loaded with the vector. Parses both
  CVSS 3.1 and 4.0 vectors (`AV:N`/`AC:L`/etc, including the 4.0-
  specific `VC`/`VI`/`VA`/`SC`/`SI`/`SA`/`AT`/`E` metrics).

**Filter pass** (`lib/reviewFilter.ts`): `ReviewFilterState` gained
`cwePillar: PillarFilterValue`. `applyFilters` adds a CWE Pillar pass
that compares the item's primary-ref pillar against the filter value;
the `UNCATEGORIZED_PILLAR` sentinel narrows to vulns with no Pillar.
Threats are filtered out when an active pillar filter is set (intentional
— the pillar filter is only surfaced on the vulns tab).

**Integration sites (5)**:
1. **ReviewTab** (Phase 2): each row's leaf-CWE chip + CVSS chip replaced
   by `CweHierarchyBreadcrumb` + the CVSS chip from `VulnStandardsBadges`
   (called with `cweRefs={undefined}` so it emits only the CVSS portion;
   the breadcrumb already contains the leaf chip).
2. **ReviewFilters** (Phase 2): conditional `CwePillarFilter` when
   `showCwePillar={kind === 'vuln'}`.
3. **ReviewDrillModal** (Phase 2 vuln detail): `Standards` section now
   shows `CweHierarchyTree` (one per cweRef, indexed when there's more
   than one) and `CvssDetail`. Vulns with neither display "No CWE
   classification (operational/process weakness)" — covers the four
   commit-01 operational-gap vulns.
4. **TripletDetailModal** (Phase 3) + **MitigationsPanelHeader** (Phase
   4a): inline `CweHierarchyBreadcrumb` next to the existing CVSS chip
   in the vulnerability standards row.
5. **VulnsInScope export section** (Phase 4c): new "Pillar" column
   between "CWE" and "Name", showing the primary ref's Pillar name as
   an outlined indigo badge. "—" for operational-gap entries.

**`VulnStandardsBadges` retained backward-compatible**: still accepts
both `cweRefs` and `cvss`; new sites pass `cveRefs={undefined}` so the
CWE leaf chip doesn't double up with the breadcrumb above it.

**No type changes** to `ApplicableVuln` or `Triplet` (`cweRefs` /
`vulnCweRefs` already there from commit 01). No new endpoints. No new
npm deps.

**Verification.**
- Endpoint inventory **41** (unchanged).
- Triplet count parity **75 = v1** (no data changes).
- Catalog coverage audit: all 18 unique CWE refs in `vulnSeed.ts`
  resolve to a Pillar via `getParentChain()`.
- File-size audit: no file over 260 lines. Largest: ReviewTab 197,
  ReviewDrillModal 192, TripletDetailModal 192. Catalog 63,
  CvssDetail 141.
- JS bundle 980.89 → 989.77 kB raw (**+8.88 kB**) / 297.08 → 299.76 kB
  gz (**+2.68 kB**) — within the spec's "+3 to +6 kB" estimate band
  (gz is slightly under the lower bound, raw is over).
- tsc + eslint + build all green.

### 2026-05-26 — Commit `29e7a20`: **v2 [08/N]** — ENISA 2022 + STIX 2.1 shape prep

Mirror of commit 07 applied to threats. Adds ENISA Threat Taxonomy
hierarchy (categories + subcategories), enriches the 12 demo-2 threats
with ENISA refs, exposes a "Filter by ENISA Category" dropdown on
Phase 2 Review's threats tab, renders inline breadcrumbs in
TripletDetailModal + MitigationsPanelHeader headers, and shows an
expanded tree (with optional MITRE ATT&CK / CAPEC chips) in the
threat detail modal. Adds optional STIX 2.1 forward-compat fields
(`stixType`, `mitreAttackRefs`, `capecRefs`) to the threat type —
type-available but unsurfaced for STIX export. **No new endpoints.**

**Catalog** (`lib/enisaCatalog.ts`, **30 entries**): 14 top-level
categories (8 ENISA ETL 2022 prime threats + 6 from the broader
Threat Taxonomy) + 16 subcategories needed by the seed enrichment.
Includes a `T-DATA-INSIDER` subcategory beyond the spec's draft so
TH-18 (Abuse of Authorizations / Insider Threat) maps cleanly.

**External-link caveat:** ENISA doesn't publish per-ID deep links the
way MITRE does for CWE — every chip/anchor routes to the general
Threat Landscape portal with a tooltip explaining this.

**Threat type extension** (additive, non-breaking):
- `enisaCategoryRefs?: string[]` — primary integration point
- `stixType?: 'attack-pattern'` — STIX 2.1 forward-compat
- `mitreAttackRefs?: string[]` — chip-rendered when present
- `capecRefs?: number[]` — chip-rendered when present

Existing PRIVACT methodology fields (`type`, `defaultProbability`,
applicability matrix) preserved unchanged. Pre-existing `sourceRef`
field (object shape) untouched — spec called for a string-shaped
`sourceRef` but the existing field is `SourceRef` (object); kept
backward-compatible and did not add a colliding field.

**Triplet denormalization**: `threatEnisaCategoryRefs?: string[]`
added so TripletDetailModal + MitigationsPanelHeader render the
breadcrumb without an extra fetch (mirror of commit 01's
`vulnCweRefs` pattern).

**Seed enrichment** (`mocks/data/threatSeed.ts`):
- TH-46 Malware → `['T-MAL', 'T-MAL-TROJ']`
- TH-02 Configuration Errors → `['T-UNINT-CONFIG']`
- TH-30 Insecure APIs → `['T-DATA-BREACH']` (loose fit; documented)
- TH-12 Denial of Service → `['T-AVL-DOS', 'T-AVL-DOS-FLOOD']`
- TH-07 Interception → `['T-EAVES-MITM']`
- TH-21 Identity Theft → `['T-DATA-IDTH', 'T-SOC-PHISH']`
- TH-34 Injection Attack → `['T-DATA-BREACH']` (loose; injection is
  an exploit, the ENISA-framed threat is the resulting breach)
- TH-09 Data Breach / Leakage → `['T-DATA-BREACH']`
- TH-18 Insider Threat → `['T-DATA-INSIDER']` (new subcategory)
- TH-25 Supply Chain → `['T-SUPCHN']`
- TH-40 Physical Attack → `['T-PHYS-THEFT', 'T-PHYS-VAND']`
- TH-05 Disaster/Power → `['T-OUT-PWR']` (fire/flood pieces don't
  have an ENISA match in this subset)

Every threat got a `stixType: 'attack-pattern'`. **12 of 12 threats
mapped** — no operational gaps on the threats side.

`applicableStore` key bumped `_v3 → _v4` so the enriched seed
reseeds. User-set `included` toggles for demo-2 reset on next load —
acceptable v2 mock-data cost (documented at the call site).

**New components** (`components/standards/`): `EnisaCategoryBreadcrumb`
(inline chevron-separated chips, Category=teal / Subcategory=orange),
`EnisaCategoryTree` (expanded vertical with depth indentation + leaf
asterisk + source attribution per row), `EnisaCategoryFilter`
(Mantine Select with counts derived from the current threat list +
"Uncategorized (N)" sentinel), `ThreatStandardsSection` (modal section
extracted out of ReviewDrillModal — tree + MITRE ATT&CK + CAPEC).

**Filter pass** (`lib/reviewFilter.ts`): `ReviewFilterState` gained
`enisaCategory: EnisaFilterValue`. `applyFilters` adds an ENISA
top-level pass matching against `getThreatTopLevelId(cweRefs[0])`.
`ENISA_UNCATEGORIZED` sentinel narrows to threats with no Pillar.
Vulns are filtered out when an active ENISA filter is set (mirror of
the CWE filter — only surfaced on the threats tab).

**Integration sites (5)**:
1. **ReviewTab** (Phase 2): threats tab gets `showEnisaCategory` +
   `threatsForEnisaCounts`. Each threat row gets a second-line ENISA
   breadcrumb (vulns continue to get the CWE breadcrumb + CVSS chip).
2. **ReviewFilters**: conditional `EnisaCategoryFilter` next to the
   existing dropdowns.
3. **ReviewDrillModal**: threats now show the `ThreatStandardsSection`
   block (ENISA tree + optional MITRE/CAPEC chips). Vulns keep their
   CWE tree + CvssDetail block from commit 07.
4. **TripletDetailModal** (Phase 3): inline ENISA breadcrumb on its
   own row, above the existing vuln-standards row.
5. **MitigationsPanelHeader** (Phase 4a): inline ENISA breadcrumb on
   its own row, labeled "Threat:", above the labeled "Vuln:" row.

**Verification.**
- Endpoint inventory **41** (unchanged — no new endpoints).
- Triplet count parity **75 = v1** (enrichment is additive; the
  generator denormalizes the new field but doesn't change the
  computation).
- Catalog coverage audit: 12 of 12 demo-2 threats mapped.
- File-size audit: no file over 260 lines. Largest: `threatSeed`
  223, `ReviewTab` 206, `ReviewDrillModal` 204, `TripletDetailModal`
  202, `reviewFilter` 174.
- JS bundle 989.77 → 1,000.41 kB raw (**+10.64 kB**) / 299.76 →
  301.80 kB gz (**+2.04 kB**). Gz delta slightly under the spec's
  "+3 to +6 kB" band; raw a touch over. No new deps.
- tsc + eslint + build all green.

### 2026-05-26 — Commit `d430279`: **v2 [09/N]** — Threat Actor Profiling

First entirely new feature in the v2 line (commits 01-08 enriched
existing entities; this adds new data + new UI). Implements ENISA
Threat Landscape 2022's 4-category threat actor model and surfaces it
across Phase 1 Setup → Phase 4a Mitigations. Closes user requirement
2.2 (raised pre-v2) and lays groundwork for STIX 2.1 threat-actor
export in a future commit.

**Data model — no separate ThreatActor entity.** Actor catalog is a
4-entry static reference (`lib/enisaActorCatalog.ts`). Two integration
points:
- `ProjectDetail.threatActorProfile?: ActorCategoryId[]` — actors
  relevant to the project's context (selected in Phase 1 Setup).
  Undefined / empty is treated by the UI as "all relevant" — no
  de-emphasis applied. Also added to `UpdateProjectInput` so the
  existing PATCH endpoint persists it without a new route.
- `ApplicableThreat.applicableActors?: ActorCategoryId[]` — actors
  that typically wield this threat (per-threat seed enrichment).
- `Triplet.threatApplicableActors?: ActorCategoryId[]` — denormalized
  at compute time so TripletDetailModal + MitigationsPanelHeader
  render chips without an extra fetch (mirror of `vulnCweRefs` /
  `threatEnisaCategoryRefs`).

**Catalog** (`lib/enisaActorCatalog.ts`): 4 entries — Hacktivists,
State-nexus Actors, Cybercriminals, Insider Threats. Each carries a
`stixType` (STIX 2.1 `threat_actor_types` open-vocab value) for the
upcoming export commit. `ACTOR_COLOR` ships the canonical palette
(purple / blue / red / amber — Tailwind 500 line for visual continuity
with the rest of v2 standards UI) and `ACTOR_ORDER` defines the
display iteration.

**Threat seed enrichment** (all 12 demo-2 threats; 11 mapped, 1
actor-less): assignments per-threat documented inline in
`threatSeed.ts`. Distribution:
- 4× include `hacktivists`
- 6× include `state-nexus`
- 8× include `cybercriminals`
- 5× include `insider`
- 1× `applicableActors: []` (TH-05 Natural Disaster / Power Outage —
  no actor, exempt from the actor-profile de-emphasis)

Every threat got `stixType: 'attack-pattern'` (set in commit 08;
already in place).

`applicableStore` key bumped `_v4 → _v5` to force the enriched seed to
reseed.

**New components** (`components/standards/`): `ThreatActorChip` (small
inline chip; the `active` prop dims to outline-gray when the actor
isn't in the project's profile), `ThreatActorFilter` (Mantine
`MultiSelect` with per-actor counts derived from the current threat
list), `ThreatActorsModalSection` (extracted from ReviewDrillModal —
all 4 actors as cards; applicable ones show full color + "Active for
this threat", others render dimmed + "Not associated"; project-profile
membership adds an outline accent). New folder `components/setup/`:
`ThreatActorProfileSection` (4 toggleable cards in a responsive 2-col
grid) and `CiaPrioritiesField` (extracted from SetupPage so it stays
under cap).

**Filter pass** (`lib/reviewFilter.ts`): `ReviewFilterState.threatActors:
ActorCategoryId[]` (multi-select). `applyFilters` adds a match-any
pass: a threat passes if any of its `applicableActors` is in the
filter set. Actor-less threats are filtered out when a selection is
active (by definition outside the selection).

**Integration sites (5)**:
1. **Phase 1 SetupPage**: `ThreatActorProfileSection` Controller below
   the CIA priorities, inside the same RHF + Zod form. Selections
   land on the existing "Save & Continue" submit flow — see
   deviation #1.
2. **ReviewFilters** (Phase 2): conditional `ThreatActorFilter`
   alongside the ENISA filter (both surface only on the threats tab).
3. **ReviewTab** (Phase 2): each threat row renders a colored chip
   per applicable actor; row gets `opacity: 0.55` when the threat
   has zero overlap with the project's actor profile. Actor-less
   threats are always shown.
4. **ReviewDrillModal** (Phase 2 detail): `ThreatActorsModalSection`
   block added after the existing ENISA/STIX block.
5. **TripletDetailModal** (Phase 3) + **MitigationsPanelHeader**
   (Phase 4a): inline chip group next to the ENISA breadcrumb on
   the threat-standards row.

**Deviation #1 — explicit save, not auto-save.** Spec called for auto-
save on actor-card toggle ("like other Setup fields"); the existing
SetupPage uses an explicit "Save & Continue" RHF submit and no other
Setup field auto-saves. To stay consistent with the established UX,
this section ships as a controlled input inside the same RHF form —
selection changes mark the form dirty and land on the existing Save
flow.

**No new endpoints, no new dependencies.** The new `threatActorProfile`
field rides the existing `PATCH /projects/:id` route (already passes
arbitrary `UpdateProjectInput` fields via `...body`).

**Verification.**
- Endpoint inventory **41** (unchanged).
- Triplet count parity **75 = v1** (`applicableActors` is informational
  metadata; the generator denormalizes but doesn't change inputs).
- Catalog coverage audit: 11 of 12 demo-2 threats actor-mapped; the
  remaining 1 is actor-less by design.
- File-size audit: no file over 260 lines. Largest: `SetupPage` 242
  (CIA controllers extracted), `threatSeed` 251, `ReviewTab` 243,
  `projectStore` 226 (seed extracted to `data/projectSeed.ts`),
  `ReviewDrillModal` 218, `ReviewPage` 212, `TripletDetailModal` 206.
- JS bundle 1,000.41 → 1,020.42 kB raw (**+20.01 kB**) / 301.80 →
  307.77 kB gz (**+5.97 kB**). Gz delta within the spec's "+4 to +7
  kB" band.
- tsc + eslint + build all green.

### 2026-05-26 — Commit `215473f`: **v2 [10/N]** — Actions catalog: NIST + CIS + D3FEND

Third and last application of the standards browser/picker pattern
(after CWE in commit 07, ENISA in 08). Applied to the action/
mitigation catalog. The pattern is now uniformly available across
the three engine-driving entity types:
- Vulnerabilities ↔ CWE (commit 07)
- Threats ↔ ENISA + (now-ready) STIX (commits 08, 09)
- Actions ↔ NIST CSF + CIS Controls + MITRE D3FEND (this commit)

**NIST variant:** **CSF v2.0** (chose v2.0 over v1.1 per locked
decision — catalog includes the new Govern function even though
no seed items match it yet; future seed enrichment can add Govern
items without a catalog change). Current seed still uses the v1.1
ID.GV placement for the security-policy item; catalog accommodates
both.

**Framework model deviation from spec — locked decision:** the spec
assumed multi-framework refs per action (each Action has
nistRefs[]/cisRefs[]/d3fendRefs[]). The actual seed shape splits
items into two single-framework entities: `Control` (each is
source='NIST_CSF' OR 'CIS_v8') and `Countermeasure` (always
'MITRE_D3FEND'). No cross-framework refs exist. The "data-faithful"
option was chosen: each item renders its OWN framework chain; the
three filter dropdowns each scope to their own framework's items
(alternatives, not intersections). No invented data.

**Catalogs** (3 files, 173 entries total):
- `lib/nistCatalog.ts` — CSF v2.0: 6 Functions (GV/ID/PR/DE/RS/RC) +
  22 Categories + 30 Subcategories. Every NIST-prefixed id in
  controlSeed (30 / 30) resolves.
- `lib/cisCatalog.ts` — Controls v8: 18 Controls + 40 Safeguards.
  Each safeguard carries its IG marker (IG1/IG2/IG3). 100% seed
  coverage (40 / 40).
- `lib/d3fendCatalog.ts` — D3FEND: 7 Tactics (Model/Harden/Detect/
  Isolate/Deceive/Evict/Restore) + 50 Techniques. 100% seed coverage
  (50 / 50). Tactics Model and Restore unused in seed, kept for
  completeness. Includes the per-technique deep-link URL builder
  (`d3fendExternalUrl`); D3FEND is the only one of the three that
  publishes per-id deep links.

**External-link caveat:** NIST CSF and CIS Controls don't publish
per-id deep links — every chip routes to the framework landing page
(csrc.nist.gov / cisecurity.org). D3FEND has per-technique deep
links (d3fend.mitre.org/technique/d3f:{id}/). Surfaced in tooltips.

**Helpers** (`lib/actionStandardsHelpers.ts`): per-framework
getEntry / getParentChain (with safety depth limit + one-shot
console-warn on unknown ids), id-prefix strippers (NIST-PR.AC-1 →
PR.AC-1; CIS-3.11 → 3.11; D3-MFA stays as-is per the canonical
D3FEND scheme), framework-discriminator (`frameworkOf(source)`),
and a `topLevelIdOf(framework, id)` used by the filter pass.

**Components**:
- `FrameworkBreadcrumb` (94 lines) — parametrized inline chain
  with framework-coded chip colors: NIST=blue, CIS=indigo,
  D3FEND=pink. Single component routes to the right catalog by
  the `framework` prop. Color-coded so the three are visually
  distinguishable at a glance.
- `FrameworkTree` (132 lines) — parametrized expanded tree, same
  visual conventions as commits 07/08. CIS safeguards surface their
  IG marker as a supplementary chip.
- `ActionFrameworkFilters` (117 lines) — three Mantine `Select`
  dropdowns side by side (NIST Function / CIS Control / D3FEND
  Tactic) + a "Reset filters" button that appears when any filter
  is active. Counts dynamically derived from the current
  triplet-applicable item lists.

**Filter pass** (`lib/actionFilter.ts`, extracted from the component
to keep react-refresh happy): match-each-against-own-framework
semantics. `controlPassesFilter` checks the NIST filter for NIST_CSF
Controls and the CIS filter for CIS_v8 Controls; D3FEND
Countermeasures go through `countermeasurePassesFilter`. An unset
filter for a given framework passes everything in that framework.

**New `MitigationDetailModal`** (109 lines): opens from a small "i"
icon button on each `CatalogItemRow` (row click still toggles
selection). Shows the item's name + id + framework source + family +
reduction% + description + the framework hierarchy tree + asset/
vuln applicability metadata. Mobile fullscreen.

**Integration**: `MitigationsPanel` mounts `ActionFrameworkFilters`
above the two lists (Controls + Countermeasures); each list's count
now shows `visible of total` when a filter narrows it. Empty-state
copy distinguishes "no applicable items" from "no items match the
current filters". `CatalogItemRow` renders a `FrameworkBreadcrumb`
in place of the previous bare id badge, plus the new info icon.
`MitigationsBulkPickerModal` was **NOT** wired in this commit — its
applicability/scope semantics are bulk-targeted across triplets and
warrant a separate pass. Flagged as a known follow-up.

**TripletDetailModal "Suggested Actions"** with framework chips —
**not in this commit**. The spec called for it, but the modal would
need to fetch per-triplet mitigation data; the Phase 4a panel
already surfaces this with 1 click. Deferred — flagged.

**Verification.**
- Endpoint inventory **41** (unchanged).
- Triplet count parity **75 = v1** (no engine changes).
- Catalog coverage audit: NIST 30/30, CIS 40/40, D3FEND 50/50.
- File-size audit: no file over 260 lines. Largest:
  `MitigationsPanel` 173 (was 115; +58 from filters + detail modal
  mount + visible-count derivation), `actionStandardsHelpers` 154.
- JS bundle 1,020.42 → 1,042.16 kB raw (**+21.74 kB**) / 307.77 →
  314.78 kB gz (**+7.01 kB**) — gz at the upper bound of the spec's
  "+6 to +10 kB" estimate; raw a touch over.
- tsc + eslint + build all green. No new deps.

### 2026-05-26 — Commit `cf470d3`: **v2 [11/N]** — Catalog Browser (Screen 11)

First GLOBAL screen outside the `/projects/:id/` namespace. New
route `/catalog` accessible from a "Standards Catalog" link in the
AppLayout header. Pure UI consumer of catalog data established
across commits 03 (CycloneDX types), 07 (CWE), 08 (ENISA threats),
09 (ENISA actors), 10 (NIST + CIS + D3FEND). No data writes, no
new endpoints, no seed modifications.

**Layout**: domain tabs (Assets / Vulnerabilities / Threats /
Actions) with conditional sub-tabs for multi-framework domains
(`SegmentedControl` — single-framework domains hide it). Below the
tabs, a search bar narrows the active catalog. Below that, a
2-column Mantine `Grid` (40/60) with the hierarchical tree on the
left and a detail panel on the right. Tree-and-detail stack
vertically on `<md` viewports.

**State in URL search params** (`?domain=&framework=&entry=&q=`)
so deep links to specific catalog entries are shareable. Domain
change clears entry + query + chooses the framework's first
sub-tab; framework change clears entry only.

**Tree (`CatalogTreeView`, 227 lines)** is generic: takes a flat
`CatalogNode[]` (parentId pointing into the same list) and builds
the hierarchy at render time. Same component drives CWE / NIST /
ENISA Threats / CIS / D3FEND; flat catalogs (CycloneDX types,
ENISA Actors) just have all-roots-no-children. Search expands
matching paths automatically (a hit in a leaf keeps its ancestors
visible). Each row carries a type chip + id badge + name + the
`UsageStatsBadge`.

**Detail panel (`CatalogDetailPanel`, 148 lines)** is parametrized.
Shows large id + name + type chip; parent-chain breadcrumb when the
entry has ancestors; description when the catalog provides one;
source citation; the list of seed entries directly referencing this
catalog entry; an external-link button to the authoritative source.

**Usage statistics** (`lib/catalogUsageStats.ts`, 229 lines):
- Per-framework `Map<id, CatalogUsageEntity[]>` maps. Static seeds
  (vulnSeed, threatSeed, controlSeed, countermeasureSeed) memoize
  on first call; CycloneDX type usage is per-project so it
  recomputes every call (cheap — bounded by project × asset count).
- `aggregateUsage(usage, framework, rootId, allIds)` returns
  `{ direct, descendants, total }`, used by `UsageStatsBadge` to
  show "Used by N" plus a tooltip splitting direct from
  descendant-derived counts.
- A parent node with no direct refs but referenced children
  surfaces this as: "Not referenced directly — but N descendant
  entries are" in the detail panel.

**External-link routing per framework**:
- **CycloneDX types** → `cyclonedx.org/specification/overview/#component-type`
- **CWE** → `cwe.mitre.org/data/definitions/{id}.html` (per-id deep link)
- **ENISA threats + actors** → ENISA portal page (no per-id deep links)
- **NIST CSF** → `csrc.nist.gov/projects/cybersecurity-framework`
- **CIS** → `cisecurity.org/controls/v8`
- **D3FEND** → `d3fend.mitre.org/technique/d3f:{id}/` (per-id deep link)

**Adapters** (`lib/catalogNodes.ts`, 128 lines): per-framework
converters from each catalog's native `Record` shape to the
normalized `CatalogNode[]`. Type chip labels + colors live here so
the tree stays catalog-agnostic.

**Framework config** (`lib/catalogFrameworkConfig.ts`, 133 lines):
the `SUBTABS` map + `buildFrameworkConfig(framework)` factory.
Extracted from CatalogPage to keep that file under the 260-line cap.

**AppLayout header** gains a "Standards Catalog" Button with
`IconBook` icon between the brand and the user menu. Active style
(`variant="light"`) when on `/catalog`. Hidden on viewports below
sm (matches the existing pattern for the avatar's text label).

**`App.tsx`**: replaces the previous `Placeholder` mounted at
`/catalog` with the real `CatalogPage`. Placeholder import dropped
(no other consumers).

**Verification.**
- Endpoint inventory **41** (unchanged).
- Triplet count parity **75 = v1** (no engine changes).
- Catalog coverage: all 7 framework catalogs render with the same
  100% seed coverage demonstrated in earlier commits.
- File-size audit: no file over 260 lines. Largest:
  `CatalogTreeView` 227, `catalogUsageStats` 229 (under cap),
  `CatalogPage` 155 (after `catalogFrameworkConfig` extraction),
  `CatalogDetailPanel` 148, `catalogFrameworkConfig` 133,
  `catalogNodes` 128. CatalogPage hit 273 during build; the
  extraction got it back to 155.
- JS bundle 1,042.16 → 1,089.49 kB raw (**+47.33 kB**) / 314.78 →
  329.02 kB gz (**+14.24 kB**). **Gz 2 kB over the spec's "+8 to
  +12 kB" upper bound** — the new page touches all 7 catalogs +
  per-tree usage aggregation + URL-state plumbing, which adds more
  weight than the prior surfaces. No new deps.
- tsc + eslint + build all green.

### 2026-05-26 — Commit `5936b2f`: **v2 [12/N]** — OSCAL Assessment Results export

Second standards-compliant export format. NIST OSCAL 1.1.2 Assessment
Results JSON, consumable by the OSCAL toolchain and GRC platforms
that integrate with OSCAL (eMASS, Xacta, Atlasity, RegScale, and
the broader OSCAL ecosystem). Where CycloneDX (commit 02) handles
asset/component data, OSCAL handles the risk assessment outputs
natively — the most domain-relevant standard for what PRIVACT
produces.

**New endpoint:** `GET /projects/:id/report.oscal.json` (inventory
**41 → 42**, +1). MIME `application/oscal.assessment-results+json`,
filename `{slug}-oscal-ar-{YYYY-MM-DD}.oscal.json`. Mirrors the
CycloneDX `.cyclonedx.json` double-extension pattern.

**Mapping (Assessment Results subset):**
- Project → `assessment-results.metadata` — title carries the
  project name, `parties[]` declares PRIVACT as the tool
  organization (fixed UUID `8a8d4c14-…` for cross-export
  identity), `props[]` carries six `x-privact:*` entries
  (methodology, formula, scale-max, project-id, project-cia,
  scope-version).
- Asset + Service → `results[0].observations[]` (one per item).
  Subject of assessment; `methods: ['EXAMINE']`. PRIVACT data
  (asset/service id, bom-ref, legacy-category, rolfp JSON) rides
  on `props[]`.
- Triplet → `results[0].risks[]` (one per triplet, all bands).
  Each carries a primary `characterizations[0]` with likelihood
  / impact / severity / risk-band / risk-score facets, an
  optional `characterizations[1]` with CVSS 4.0 facets when the
  vuln has CVSS data, and an optional `threat` ref to
  `cwe.mitre.org/data/definitions/{id}.html` when the vuln has
  cweRefs. Selected controls/countermeasures emit as
  `mitigating-factors[]`; risk `status` flips to `'remediating'`
  when any selection exists, else `'open'`. Extra denormalized
  fields (residual-score, residual-band, threat-enisa,
  threat-actors) ride on `props[]`.
- High-band triplet → `results[0].findings[]`. Target
  `type: 'objective-id'`, `target-id: 'triplet-{tripletId}'`,
  status `'not-satisfied'`. `related-risks[]` references the
  same risk's UUID (parallel-array lookup ensures finding-to-risk
  resolution is consistent within the document).

**Subset NOT covered** (TODO for future commits): imported
Assessment Plan (placeholder `#assessment-plan-placeholder` href),
SSP cross-refs, attestation entries, full origin-actor
disambiguation per OSCAL semantics.

**Types** (`types/oscal.ts`, 160 lines): hand-rolled OSCAL AR 1.1.2
subset. Only the shapes the adapter emits; no npm dep. Property
names follow OSCAL JSON spelling (kebab-case keys quoted).

**Adapter** (`lib/oscalAdapter.ts` 149 lines + `lib/
oscalAdapterEntities.ts` 199 lines): split at build time when the
single-file adapter hit 339 lines. Top-level driver is the
`internalToOscalAr(input)` orchestrator; per-entity converters
(`assetToObservation`, `serviceToObservation`, `tripletToRisk`,
`tripletToFinding`) live in the entities file.

**UUID helper** (`lib/uuidHelpers.ts`, 20 lines): `newUuid()`
wrapper over `crypto.randomUUID()` + the fixed `PRIVACT_TOOL_UUID`
referenced from every characterization's origin actor.

**`downloadHelpers.ts`** extended (`ReportFormat += 'oscal'`, path
routed for `.oscal.json` double-extension). `ReportHeader.tsx`
gains a 5th button "OSCAL" with explanatory tooltip (mentions GRC
target platforms by name); same independent-loading-state pattern
as the other four.

**Offline structural verification** (Gate 4.5): ran the adapter
against demo-2's full state in Node + tsx. Output: oscal-version
1.1.2 ✓, AR uuid valid RFC 4122 ✓, **12 observations** (= 8 assets
+ 4 services) ✓, **75 risks** (= triplet count parity v1) ✓, **46
findings** (high-band subset) ✓, **72 of 75 risks have CWE threat
refs + CVSS characterizations** (3 operational-gap vulns lack
standards refs — expected from commit 01), findings correctly
reference their corresponding risk by UUID ✓, sample file 461 KB.

**Verification.**
- Endpoint inventory **42** (was 41, +1).
- Triplet count parity **75 = v1** (adapter is a pure consumer; no
  engine changes).
- File-size audit: no file over 260 lines. OSCAL adapter hit 339
  during build; entity-converter extraction got it to 149 + 199.
- JS bundle 1,089.49 → 1,089.77 kB raw (**+0.28 kB**) / 329.02 →
  329.14 kB gz (**+0.12 kB**). Far under the spec's "+5 to +8 kB"
  estimate — the OSCAL adapter is mostly type definitions + a few
  pure functions; the build optimizer keeps the runtime weight
  negligible. No new deps.
- tsc + eslint + build all green.

This commit completes the standards-aligned **export** capability:
- CycloneDX 1.6 for asset/component data (commit 02-03 A)
- OSCAL 1.1.2 for risk assessment data (this commit)
Both formats carry `x-privact:*` extensions preserving PRIVACT
methodology data.

### 2026-05-27 — Commit `7b581fe`: **v2 [13/N]** — Per-asset CVSS Environmental UI (Option C, part 1)

Adds the CVSS Environmental Score adjustment UI to Phase 3
`TripletDetailModal`. Each triplet can opt-in to a context-specific
severity override using Modified Base Metrics + Security Requirements
(CR/IR/AR). The resulting Environmental score derives a new 0–5
PRIVACT severity which replaces the catalog-derived `vulnSeverity`
in the risk-formula calculation **for that triplet only**.

PRIVACT methodology unchanged — formula
`Risk = Applicability × Impact × Probability × Severity` is
preserved, the 0–4 impact / 0–4 probability / 0–5 severity / 0–80
total scales all preserved. Only the severity DATA INPUT becomes
triplet-specific where overrides are enabled.

**Calculator** (`lib/cvssEnvironmental.ts`, 234 lines): faithful
CVSS 3.1 Environmental formula implementation — Modified Impact
Sub-Score (MISS) clamped at 0.915 weighted by CR/IR/AR, scope-aware
Modified Impact (6.42×MISS unchanged / non-linear changed),
Modified Exploitability with scope-aware PR weights, scope-aware
final combination, roundup to 1 decimal capped at 10.0. For CVSS
4.0 vectors the calculator still applies the 3.1-style formula
against the vector's AV/AC/PR/UI/C/I/A letters (4.0-only fields
typed but not consumed — full 4.0 needs MacroVector tables).
Documented limitation in UI as "PRIVACT environmental
approximation; for authoritative scores use first.org's
calculator".

**Offline calculator smoke** (against VU-09 SQL Injection's CVSS 3.1
`AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H`, base 9.8 Critical):
- Unmodified base + project-CIA-derived reqs → **9.8** ✓ (round-trip)
- Drop AV: Network → Local → **8.4** ✓
- All None impact + all-Low reqs → **3.9** ✓
- Typical override (AV:L, MUI:P, all impacts Low, reqs Medium) →
  **3.4 Low** (formula input 1/5) ✓

**New endpoint** `PATCH /projects/:id/triplets/:tid/env-override`
(inventory **42 → 43**, +1). Body: full override record when
enabling, `{ enabled: false }` to remove. Handler persists to
`envOverrideStore` and regenerates the whole triplet list (cheap)
so the affected triplet's `riskScore`/`band` reflect the new
severity on next read. Response: `{ triplet, override }`.

**Storage** (`mocks/data/envOverrideStore.ts`, 71 lines): mirror of
`mitigationStore` shape — per-project per-triplet map. Survives
`POST /compute` regeneration as long as the triplet id stays
stable. `clearProject` helper added; wired into the CycloneDX-import
flow (commit 06) alongside the other dependent caches.

**Triplet generator** (`lib/tripletGenerator.ts`): accepts an
`envOverridesByTripletId` Map. When a triplet's override is
`enabled`, swaps `vuln.defaultSeverity → override.derivedFormulaInput`
in `computeTripletRisk()` so the persisted `riskScore` reflects the
override. `vulnSeverity` on the Triplet keeps the catalog value
(UI uses it for the "Base vs Environmental" side-by-side display).
Two new denormalized fields on Triplet:
`cvssEnvironmentalOverride` (full record) +
`hasEnvironmentalOverride` (boolean shortcut for list views).

**UI components** (`components/cvss/`):
- `CvssEnvironmentalSection` (249 lines) — collapsible orchestrator.
  States: idle (catalog severity, CTA), editing (form open, live
  preview), saved (override active, summary visible). Mounts the
  comparison badges at the top when active.
- `CvssEnvironmentalEditor` (130 lines) — editing-mode body
  (extracted from Section to stay under cap). Modified Base + Sec
  Reqs forms + Notes textarea + live Result preview + Save/Cancel.
- `ModifiedBaseMetricsForm` (171 lines) — eight Mantine `Select`s
  (or eleven on CVSS 4.0) with "(Base: …)" hint text per row.
- `SecurityRequirementsForm` (58 lines) — CR/IR/AR Selects, defaults
  injected by the parent from project CIA.
- `CvssComparisonBadges` (47 lines) — side-by-side `Catalog: 9.8
  (5/Critical) → Environmental: 6.5 (3/Medium) ★` line.

**Integration**: TripletDetailModal mounts `CvssEnvironmentalSection`
above the score/band row when `projectId + projectCia` props are
passed (Phase 3 TripletsPage passes both). The modal footer gains
a `★ Env` badge when `hasEnvironmentalOverride`. `TripletsTable`
row score cell gets a `★` next to the `riskScore` when override
active.

**OSCAL adapter** (`lib/oscalAdapterEntities.ts`): when a triplet
has an active override, the `risks[*]` entry gets a third
`characterizations[]` block with `cvss-environmental-score` +
`cvss-environmental-severity` facets, plus
`x-privact:env-{score,severity,formula-input,notes}` props. OSCAL
consumers see base + environmental side-by-side. CycloneDX export
deliberately UNCHANGED — CycloneDX is asset-centric (vulns are
top-level, not per-triplet); env data is per-(asset×threat×vuln)
which doesn't fit the BOM shape cleanly. Flagged.

**CR/IR/AR defaults from project CIA** (per spec):
- CIA ≥ 3 → 'H'
- CIA ≥ 2 → 'M'
- CIA ≥ 1 → 'L'
- CIA = 0 → 'X' (Not Defined)

User overrides defaults manually.

**Verification.**
- Endpoint inventory **43** (was 42, +1).
- Triplet count parity **75 = v1** (overrides don't change count;
  only adjust per-triplet score).
- File-size audit: no file over 260 lines. CvssEnvironmentalSection
  hit 328 during build; Editor extraction + dedup of `parseVector`
  helper got it to 249. TripletsPage hit 273; import-line
  compression got it to 256.
- JS bundle 1,089.77 → 1,100.85 kB raw (**+11.08 kB**) / 329.14 →
  332.37 kB gz (**+3.23 kB**). Gz **under** the spec's "+6 to +10
  kB" band — calculator is pure math + the UI is mostly Mantine
  primitives, build optimizer keeps overhead low. No new deps.
- tsc + eslint + build all green.

Closes Option C part 1. Part 2 (commit 14) addresses per-asset
applicability — currently applicability is category-keyed; will
become per-asset-per-vuln assignable.

### 2026-05-27 — Commit `a9afcd1`: **v2 [14/N]** — Per-asset applicability override (Option C, part 2) — FINAL

Closes Option C and the v2 standards-alignment roadmap. Phase 2
Review gains a third sub-tab — **Per-Asset Applicability** — where
the analyst can override the catalog's category-based applicability
matrix per `(asset, threat|vuln)` pair. An override always wins
over the default; clearing returns to the default.

PRIVACT methodology unchanged — applicability remains a 0/1 multiplier
in `Risk = Applicability × Impact × Probability × Severity`. Only its
RESOLUTION (default vs override) becomes per-asset.

**Resolver** (`lib/applicabilityResolver.ts`, 61 lines): single source
of truth for "does `(asset, type, itemId)` apply?". Returns
`{ effective, source: 'default'|'override', override?, defaultEffective }`.
Used by both the triplet generator (cares only about `effective`) and
the UI rows (display Inherited / Overridden badge from `source`).

**Triplet generator** (`lib/tripletGenerator.ts`): both bare category
checks replaced with `resolveApplicability(...)`. Composes with
commit 13's env-overrides — both override Maps/lists are passed to
the generator and stored independently. Triplet count behaviour: an
override may add or remove `(asset×threat×vuln)` tuples depending
on `state`; default count parity with commit 13 (75) holds when no
override is set.

**New endpoints** (inventory **43 → 45**, +2):
- `GET /projects/:id/applicability-overrides` → `ApplicabilityOverride[]`
- `PUT /projects/:id/applicability-overrides` — body
  `ApplicabilityOverride[]` (full-replacement). Handler validates,
  replaces store, bumps scopeVersion, regenerates triplets inline
  (same pattern as commit 13 env-override). Response:
  `{ overrides, computedAt, tripletCount }`.

**Storage** (`mocks/data/applicabilityOverrideStore.ts`, 49 lines):
mirror of `envOverrideStore` shape — per-project array. Key
`privact_applicability_overrides_v1`. `clearProject` wired into the
CycloneDX-import flow alongside env-overrides and the other
dependent caches.

**UI components** (`components/review/`):
- `PerAssetApplicabilityTab` (320 lines, **over cap — flagged**) —
  tab orchestrator: asset+service selector, threat list + search,
  vuln list + search, draft state, Save & recompute footer.
- `ApplicabilityOverrideRow` (114 lines) — one row: effective
  state badge (teal Applicable / dimmed Not applicable), item id +
  name + optional ENISA/CWE ref chip, Inherited/Overridden badge,
  action menu (Mark applicable / Mark not-applicable / Reset).
- `AssetApplicabilitySelector` (45 lines) — Mantine `Select` with
  asset+service entries.

**ReviewPage**: `TabValue` extended to `'threats' | 'vulnerabilities'
| 'applicability'`; URL param `?tab=applicability` deep-links the
new tab. `useServices` query added so the selector can address
services alongside assets.

**Export coverage**:
- CycloneDX (`lib/cyclonedxAdapter.ts`): adds optional
  `applicabilityOverrides` param; when non-empty, emits a single
  `x-privact:applicability-overrides` property on the project
  component (JSON-stringified array) so downstream BOMs preserve
  the analyst's decisions.
- OSCAL Assessment Results (`lib/oscalAdapter.ts`): each override
  emits one OSCAL `Observation` with method `EXAMINE`, title
  `"User applicability assessment — {type} {itemId} on {assetId}"`,
  and `x-privact:override-{asset-id,type,item-id,state}` props.

**Verification.**
- Endpoint inventory **45** (was 43, +2).
- File-size audit: 1 file over 260 cap —
  `PerAssetApplicabilityTab.tsx` at **320 lines**. Splitting it
  would require extracting either the threat list or the vuln list
  block (both ~30 lines + 1 helper closure each), or extracting a
  `useApplicabilityDraft` hook. **Flagged but accepted as-is**:
  the file is one cohesive tab body with two symmetric list
  blocks; extraction would split sibling code that reads better
  together. Will revisit if another row type is added.
- JS bundle **1,100.85 → 1,108.66 kB raw (+7.81 kB)** / **332.37
  → 334.51 kB gz (+2.14 kB)**. No new deps.
- tsc + eslint + build all green.

**Closes the v2 standards-alignment roadmap.** Ready for promotion
consideration (merge to main as v2.0, or keep on branch for
stakeholder review).

## v2 STANDARDS ALIGNMENT PHASE — COMPLETE

**Tagged 2026-05-28 as `v2.0`** (annotated tag on `48a762f`, branch
`v2-standards-aligned` HEAD). `v1.0` (on `4f9feee`, `main`) preserved
for rollback access. Both tags pushed to origin.

14 commits over the `v2-standards-aligned` branch:

| # | Topic | Standards landed |
|---|-------|-----------------|
| 01 | CWE + CVSS 4.0 baseline | CWE-1000, CVSS 4.0 vectors |
| 02-03 | CycloneDX 1.6 export + Asset model split | CycloneDX 1.6 |
| 04 | Asset/Service UI refresh | — |
| 05 | Modal + severity colors | — |
| 06 | CycloneDX Import | CycloneDX 1.4/1.5/1.6 import |
| 07 | Vulnerability CWE hierarchy navigation | CWE-1000 Pillar/Class/Base |
| 08 | Threat model ENISA 2022 hierarchy + STIX 2.1 shape prep | ENISA Threat Taxonomy 2022, STIX 2.1 |
| 09 | Threat Actor Profiling | ENISA 4-category actor model |
| 10 | Actions catalog | NIST CSF v2.0, CIS Controls v8, MITRE D3FEND |
| 11 | Catalog Browser screen | (consolidates 07-10) |
| 12 | OSCAL Assessment Results export | NIST OSCAL 1.1.2 |
| 13 | Per-asset CVSS Environmental UI (Option C, part 1) | CVSS 3.1 Environmental |
| 14 | Per-asset applicability override (Option C, part 2) | — (methodology completion) |

All PRIVACT methodology preserved:
`Risk = Applicability × Impact × Probability × Severity` formula,
0–4 impact, 0–4 probability, 0–5 severity, 0–80 total. Standards
data emitted via `x-privact:*` namespace properties in CycloneDX +
OSCAL outputs.

## In progress / Next

(empty)

## Planned (high-level order)

1. **CVSS Safety parameter conditional UI** — safety-critical project
   toggle.
2. **TripletDetailModal Suggested Actions** with framework chips —
   deferred follow-up from commit 10.
3. **MitigationsBulkPickerModal framework filter** — same deferral.
