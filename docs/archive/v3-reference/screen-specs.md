# PRIVACT Screen Specs (detailed)

Source of truth: `PRIVACT_UI_Screens.pptx` + `docs/screens.md` (overview) +
`docs/backend-endpoints.md` (contract). This file holds the *agreed,
implementation-level* spec per screen — the answers to the working-agreement
5 questions, locked before each screen is built.

> Note: this file was committed empty in `6e87874` despite the commit message.
> Re-established on day 2 with the Screen 2 spec.

---

# v3 SUPERSEDING NOTE (2026-06-18, C9c)

> These specs describe the **v2 pipeline** and are **SUPERSEDED by the v3 live
> model**. v3 derives risk client-side along Review → Scope → Triplets →
> Mitigations (no `/compute`, no server triplet store); mitigations are
> **D3FEND-anchored** (CVE → CWE → D3FEND, severity-recompute residual); the
> Dashboard reads the live residual model; and Export is generated **in-browser**
> from that same model (no v2 export endpoints — those were deleted in C9c).
> NIST CSF / CIS are now **reference-only** in `/catalog`. For current behavior
> see `docs/v3-blueprint.md` (C7–C9) and `docs/tool-documentation.md`. The
> Mitigations, Dashboard, and Export sections below are kept as historical v2
> record only.

---

# v2 ADDENDUM (2026-06-02)

The per-screen sections below were locked at each screen's original build time
(pre-v2). The v2 standards-alignment series (commits 01-14) added new behaviour
to most existing screens plus one new global screen (Screen 11 Catalog
Browser). This addendum captures the v2 deltas in one place; the original
per-screen sections stay as historical record.

## Phase 1 Setup — v2 delta: Threat Actor Profile section

**v2 commit 09.** A new `ThreatActorProfileSection` (`src/components/setup/`)
mounts inline in the Phase 1 Setup form. Renders 4 toggleable cards for the
ENISA 4-category Threat Actor model: **Cybercriminals**, **State-Sponsored**,
**Hacktivists**, **Insider Threats**. Each card carries description + motivation
chips. Selection persists on `Project.threatActorProfile` (additive field) and
filters the threat catalog accordingly in Phase 2.

Out of scope for v2: per-actor custom probability weighting, multi-select
per-threat actor mapping (deferred to the F partial backlog).

## Phase 1b Assets — v2 delta: CycloneDX vocabulary + modal + Import BOM

**v2 commits 03-06.**

- **Type column** now shows the CycloneDX 1.6 component vocabulary (13 types:
  12 standard + `cryptographic-asset` PRIVACT extension; full list in
  `src/types/cyclonedx.ts`). The v1 7-category list is preserved as
  `legacyCategory` for engine matching, populated automatically on user-driven
  Type changes via `CATEGORY_TO_CDX_TYPE` mapping in `src/mocks/assetStore.ts`.
- **Type-conditional fields** — `version`, `supplier`, `manufacturer`, `model`,
  `serialNumber`, `purl`, `cpe`, `group`, `licenses`, `externalReferences`
  surface conditionally based on the selected `type` (e.g. `purl` for
  `application`/`library`, `cpe` + `manufacturer` for `device`).
- **Asset edit modal** — centered overlay 1000px wide on desktop (≥1024px),
  90vw on tablet (768-1023px), `fullScreen` on mobile (<768px).
  `AssetEditModal.tsx` two-column layout: left column Identification +
  CycloneDX fields, right column 15-cell ROLFP grid with severity-colored
  segmented controls (`RolfpSegmentedGrid` + `SeverityButton`). Explicit
  Save + Cancel (auto-save retired in commit 04).
- **Application/API category bifurcated** into a separate `Service` entity
  (commit 03). Services live in their own collection
  (`src/mocks/serviceStore.ts`) accessed via
  `GET /projects/:id/services`. IDs preserved across the split so links +
  triplet IDs that reference these resolve via cross-collection lookup.
- **Import BOM button** (commit 06) — opens a modal that accepts a
  CycloneDX 1.4 / 1.5 / 1.6 JSON file. Client-side parse via
  `src/lib/cyclonedxImporter.ts` (lenient — accepts any of the 3 spec
  versions), resolves CDX components into internal Asset / Service / Link
  entities (defaulting missing PRIVACT fields like ROLFP to zeros), POSTs the
  resolved payload to `POST /projects/:id/import.cyclonedx`. Side effects on
  the server: replace-all on assets/services/links, clear applicability
  state, clear computed triplets, clear mitigation selections, clear env
  + applicability overrides, bump `scopeVersion`. User runs Compute in
  Phase 3 post-import.

## Phase 2 Review — v2 delta: three-tab structure

**v2 commits 07-09, 14.**

The Phase 2 Review page (`src/pages/ReviewPage.tsx`) now has THREE tabs:

1. **Threats** tab (commit 08-09):
   - **ENISA 2022 hierarchy filter** — 12 top-level categories + 25
     subcategories. Tree-based filter UI; selected branch filters threats by
     `enisaCategoryRefs[]`.
   - **Threat Actor chips** on each row (commit 09) — shows which of the 4
     ENISA actors apply to this threat.
   - **Source filter** — Deliberate / Accidental.

2. **Vulnerabilities** tab (commit 07):
   - **CWE Pillar filter** — top-level CWE-1000 view categories
     (e.g. CWE-664 "Improper Control of a Resource", CWE-707 "Improper
     Neutralization").
   - **CWE hierarchy badges** on each row — show Pillar → Class → Base
     breadcrumb when navigable.
   - **CVSS chips** (commit 01) — colored severity chip (None/Low/Medium/
     High/Critical) with the score tooltip.

3. **Per-Asset Applicability** tab (NEW in commit 14):
   - **Asset+Service selector** dropdown (`AssetApplicabilitySelector`).
   - Two list panels: Threats list + Vulnerabilities list.
   - Each row shows: effective state badge (teal "Applicable" / dimmed
     "Not applicable"), item id + name + optional ENISA/CWE ref chip,
     **Inherited / Overridden** badge (from `resolveApplicability().source`),
     action menu (Mark applicable / Mark not-applicable / Reset).
   - Search inputs above each list.
   - "Reset all overrides for this asset" button (when any exist).
   - **Save & recompute** footer button when draft is dirty — triggers
     `PUT /projects/:id/applicability-overrides` which inline-regens triplets.

Deep-link via `?tab=applicability` URL param.

## Phase 3 Triplets — v2 delta: CVSS Environmental + override indicators

**v2 commits 07, 08, 09, 13, 14.**

`TripletDetailModal` (`src/components/TripletDetailModal.tsx`) now shows:

- **CWE breadcrumb** on the vuln side (commit 07) — links to MITRE.
- **ENISA breadcrumb** on the threat side (commit 08).
- **Threat Actor chips** (commit 09).
- **CVSS Environmental Adjustment section** (commit 13, `src/components/cvss/CvssEnvironmentalSection.tsx`)
  — collapsible per-triplet override. Mounts only when `projectId +
  projectCia` props are passed (Phase 3 `TripletsPage` passes both). States:
  - **idle** — catalog severity displayed, CTA to override.
  - **editing** — `ModifiedBaseMetricsForm` (8-11 Mantine Selects depending on
    CVSS version) + `SecurityRequirementsForm` (CR/IR/AR Selects, defaults
    injected from project CIA: `CIA ≥ 3 → H`, `≥ 2 → M`, `≥ 1 → L`, `0 → X
    (Not Defined)`) + Notes textarea + live Result preview + Save/Cancel.
  - **saved** — override active, `CvssComparisonBadges` shows side-by-side
    `Catalog: 9.8 (5/Critical) → Environmental: 6.5 (3/Medium) ★`.
- **`★` marker** on TripletsTable row score cell (commit 13) when override
  active. Modal footer also gains a `★ Env` badge.

**Applicability override visual indicators** (commit 14) — triplets emitted/
suppressed by per-asset applicability overrides flow through normally; the
indication that something is overridden lives on the Phase 2 Per-Asset
Applicability tab (Inherited/Overridden badge) rather than on the triplet
row itself.

## Phase 4a Mitigations — v2 delta: three framework filters + chips

> **SUPERSEDED (v3 C8/C9c).** This v2 mitigation panel (NIST/CIS/D3FEND framework
> filters, `MitigationsPanel`, `ActionFrameworkFilters`) was DELETED in C9c. v3
> Mitigations are vuln-instance-anchored and D3FEND-only (severity-recompute
> residual). See `docs/v3-blueprint.md` C8.

**v2 commit 10.**

- **Three framework filters** (`src/components/standards/ActionFrameworkFilters.tsx`):
  - **NIST Function** Select (CSF v2.0: Govern / Identify / Protect / Detect /
    Respond / Recover).
  - **CIS Control** Select (v8 Safeguards 1-18).
  - **D3FEND Tactic** Select (MITRE D3FEND tactics).
- Mounted in `MitigationsPanel.tsx` (the Phase 4a panel). Filter state lives
  in `src/lib/actionFilter.ts` (pure module — extracted to satisfy
  react-refresh/only-export-components lint).
- **Framework chips on rows** — Controls show NIST CSF function chip OR CIS
  Control chip (never both — controls are single-framework per the
  data-faithful decision in commit 10). Countermeasures show D3FEND tactic
  chip only.

Out of scope for v2: TripletDetailModal Suggested Actions with framework
chips (deferred follow-up); MitigationsBulkPickerModal framework filter
(same deferral).

## Phase 4c Export — v2 delta: 5 buttons

> **SUPERSEDED (v3 C9b/C9c).** The v2 server-side export endpoints + handlers
> (`report.*`, `report.cyclonedx.json`, `report.oscal.json`, `report-preview`)
> were DELETED in C9c. v3 generates all formats client-side from the live model
> (`clientDownloads`, `lib/export/cyclonedxV3` + `oscalV3`) with a generation
> stamp. See `docs/v3-blueprint.md` C9b.

**v2 commits 02, 12.**

`src/components/export/ReportHeader.tsx` `FORMATS` array contains 5 entries:

1. **PDF** — `GET /projects/:id/report.pdf` (placeholder via `officeBlobs.ts`
   in mock; backend deliverable in real).
2. **XLSX** — `GET /projects/:id/report.xlsx` (placeholder).
3. **JSON** — `GET /projects/:id/report.json`.
4. **CycloneDX 1.6** — `GET /projects/:id/report.cyclonedx.json` (commit 02).
   MIME `application/vnd.cyclonedx+json; version=1.6`. Carries
   `x-privact:applicability-overrides` on the project component when set
   (commit 14).
5. **OSCAL 1.1.2** — `GET /projects/:id/report.oscal.json` (commit 12).
   MIME `application/oscal.assessment-results+json`. Emits one EXAMINE
   Observation per applicability override (commit 14); triplets with active
   env-overrides get a third `characterizations[]` block (commit 13) with
   `cvss-environmental-score` + `cvss-environmental-severity` facets and
   `x-privact:env-*` props.

Each renders as an independent download button with tooltip. Sidebar TOC +
sectioned report preview unchanged.

## Screen 11 — Standards Catalog Browser (NEW)

**v2 commit 11.** Global standards encyclopedia at `/catalog` (outside the
`/projects/:id/` scope).

### 1. What the user sees on load

- App shell + breadcrumb `Catalog`.
- Title "Standards Catalog" + subtitle "Browse the standards PRIVACT
  references".
- **4 domain tabs** at the top:
  1. **Assets** — CycloneDX 1.6 component types.
  2. **Vulnerabilities** — CWE-1000.
  3. **Threats** — ENISA 2022 + STIX 2.1 shape preparation (sub-tabs).
  4. **Actions** — NIST CSF v2.0 + CIS Controls v8 + MITRE D3FEND (sub-tabs).
- Below the tab strip: **two-pane layout**.
  - Left pane (~40%): hierarchical tree (Mantine `NavLink` recursive) +
    search input at the top. Selecting a node highlights it.
  - Right pane (~60%): detail panel for the selected entry — id, name,
    description, hierarchy breadcrumb, external links, **usage stats**
    (count of seed entries referencing this catalog item).

### 2. What the user can do

- Switch domains via tabs.
- Sub-tabs for multi-framework domains: Threats split into ENISA / STIX
  preparation; Actions split into NIST / CIS / D3FEND.
- Search via top-of-tree input — narrows the tree to matching nodes (case-
  insensitive, debounced 200ms).
- Click any tree node → detail panel updates.
- Click external-link icons in the detail panel → opens MITRE / CWE /
  ENISA / NIST documentation in a new tab.

### 3. Data needed

All catalog data is **static reference** loaded from the hand-rolled
catalogs in `src/lib/cweCatalog.ts`, `enisaCatalog.ts`, `nistCatalog.ts`,
`cisCatalog.ts`, `d3fendCatalog.ts`. Usage stats are computed client-side
by scanning the seed data in `src/mocks/data/threatSeed.ts`,
`vulnSeed.ts`, `controlSeed.ts`, `countermeasureSeed.ts`.

No backend endpoints. Future: when the real catalog is dynamic, this screen
would shift to `GET /catalog/{domain}/tree` + `GET /catalog/{domain}/{id}`.

### 4. What happens on each action

- Tab change: clears selection, resets tree to the new domain.
- Tree node click: updates URL via `?id={catalogId}` for deep-linking.
- Search input change: debounced filter; first match auto-selects after 500ms
  of idle typing.

### 5. Out of scope for this version

- Editing catalog entries (catalog is read-only; custom entity authoring is
  the F partial backlog).
- Cross-domain navigation (e.g. clicking a CWE on a vuln entry shouldn't
  jump to the Vulnerabilities tab — purely a read-only browser per domain).
- API integration (current implementation is pure static reference).

---



As implemented in `src/pages/LoginPage.tsx`:

- Full-bleed navy gradient with animated `NetworkBackground`. Outside the
  app shell (its own layout).
- On mount: `GET /api/v1/me` — if 200, fade out and redirect to `/projects`;
  if 401, show the sign-in card.
- "Sign in with Keycloak" → sets `localStorage.privact_logged_in=true`,
  ~800ms simulated round-trip, then navigate to `/projects`.
- EU funding acknowledgment footer + version tag.
- Out of scope (deferred — see `docs/open-items.md`): real Keycloak OIDC,
  MFA, GDPR consent, session timeout.

---

## Screen 2 — Project List (BUILT day 2)

The navigational backbone: the landing screen after login.

### 1. What the user sees on load

- Shared app shell (`AppLayout`): header with PRIVACT wordmark (→ `/projects`),
  user menu (Dev User → Log out).
- Breadcrumb: `Projects`.
- Header row: title "My Projects" + subtitle, "New Project" primary button.
- Search input (filters by name).
- A Mantine `Table` (not TanStack — small list, no server pagination):
  columns **Name · Status · Created · Modified · High risk · ⋮**.
- States:
  - **Loading** — 4 skeleton rows.
  - **Error** — red alert with the message and a Retry button.
  - **Empty (no projects)** — centered empty state with a "New Project" CTA.
  - **Empty (search miss)** — "No projects match …".

### 2. What the user can do

- **Search** by name — client-side, case-insensitive, no server call.
- **Sort** — click headers: Name, Modified, High risk. Default: Modified desc.
- **New Project** — opens a modal (name input) → `POST` → toast → navigate to
  `/projects/{id}` (Screen 3, currently a placeholder).
- **Open** a project — click the name link, or row menu → Open.
- **Delete** — row menu → Delete → confirm modal → `DELETE` → toast.
- **Row menu placeholders** (disabled, backend-pending, tracked in
  `open-items.md`): Duplicate, Copy shareable link.

### 3. Data needed

`/api/v1` (MSW-mocked, localStorage-backed store, seeded with 4 sample
projects across all four statuses):

- `GET /projects` → `Project[]`
- `POST /projects` `{ name }` → `Project` (201)
- `DELETE /projects/{id}` → 204

`Project = { id, name, status, createdAt, updatedAt, highRiskCount }`,
`status ∈ draft | in_progress | completed | exported`.

### 4. What happens on each action

- Create / Delete: **wait for server** (not optimistic — list is tiny, keep it
  correct), then invalidate `['projects']`, toast, and (create) navigate.
- Search / sort: pure client-side, no refetch.

### 5. Out of scope for this version

Tracked in `docs/open-items.md`: bulk actions, archiving, list CSV export,
JSON project import, real Duplicate, real shareable link, server-side
pagination, real Keycloak, and an auth route-guard (currently any `/projects`
URL renders even when logged out — flagged as a recommended next item).

---

## Screen 3 — Project Overview / Wizard Hub (BUILT day 2)

The read-only navigational backbone the create flow lands on (`/projects/:id`).

### 1. What the user sees on load

- Shell + breadcrumb `Projects / {name}`.
- Header card: name, status badge, created/modified dates, description &
  scope (if set), CIA priority badges (Confidentiality/Integrity/Availability
  on the 0–4 impact scale, None…Critical, workbook-sourced). Top-right:
  "Export Report" (disabled until Phase 4
  complete, tooltip explains) + "Edit settings" (→ Phase 1a/Settings).
- Summary stat grid: assets, threats, vulnerabilities, triplets, high/medium
  /low risk counts.
- Vertical 4-phase timeline: Phase 1 Scope & Assets · Phase 2 Threat & Vuln
  Modeling · Phase 3 Risk Generation · Phase 4 Mitigation & Output. Each item:
  status bullet + badge (Not started / In progress / Complete), blurb,
  sub-screen links, and a Start/Continue/Review action button.
- States: loading skeleton; bad/missing id → "Project not found" alert with
  "Back to projects".

### 2. What the user can do

- Soft gating: **every phase is clickable** regardless of progress.
- Sub-screen links per phase (P1: Setup/Assets · P4: Planner/Dashboard/
  Export) navigate straight to that route.
- Phase action button → phase's first sub-screen.
- "Export Report" (gated on Phase 4 complete) → `/export`.
- "Edit settings" → `/setup`. Breadcrumb → list.

### 3. Data needed

- `GET /api/v1/projects/:id` → `ProjectDetail` = `Project` + `description`,
  `scope`, `cia`, `phases[]` (id/title/blurb/status/subScreens), `summary`
  counts. MSW derives this from the stored project: sequential phase
  completion driven by `status`; plausible mock summary numbers; 404 if the
  id is unknown.

### 4. What happens on each action

- Pure navigation only — this screen performs no writes. `useQuery(['project',
  id])`; phase status is read-only here and changes as phases complete
  elsewhere.

### 5. Out of scope for this version

- Inline metadata editing (lives in Screen 4 / Settings).
- Real phase-completion logic (derived/mocked from `status` for now).
- Hard phase-locking (chose soft gating).
- The actual phase screens (4–7 still placeholders).
- Recompute-stale banner (`docs/open-items.md`).

---

## Screen 4 — Phase 1a Setup Form (BUILT day 2)

`/projects/:id/setup`. 2-minute screen; doubles as project Settings.

### 1. What the user sees on load

- Shell + breadcrumb `Projects / {name} / Setup`.
- Form card pre-filled from `GET /projects/:id`: Name (required),
  Description, Scope (textareas), CIA priorities (three 0–4 RiskScaleInput
  sliders: None/Low/Medium/High/Critical). Buttons (wireframe slide 6):
  `Cancel` (reset to loaded; disabled when pristine) + combined
  `Save & Continue` (saves if dirty, then navigates to `/assets`).
- States: loading skeleton; bad/missing id → "Project not found" alert.

### 2. What the user can do

- Edit fields; `Cancel` (form reset); `Save & Continue` (single primary: if
  dirty → `PATCH` then navigate to `/assets`; if pristine → navigate
  directly). Navigate via breadcrumb (→ Overview / list).

### 3. Data needed

- `GET /api/v1/projects/:id` to prefill (reuses `useProject`).
- `PATCH /api/v1/projects/:id` `{ name?, description?, scope?, cia? }` →
  updated `ProjectDetail`. Mock store now **persists** these fields and bumps
  `updatedAt` (store key bumped to `_v2`). 400 on blank name, 404 on unknown
  id.

### 4. What happens on each action

- `Save & Continue` = if dirty, wait-for-server → toast, invalidate
  `['project',id]` + `['projects']` (name/modified update in the list), then
  navigate to `/assets`. If pristine, navigate directly (no no-op `PATCH`).
  Invalid forms are blocked by RHF before submit.
- Form stack: React Hook Form + Zod, Controller-wrapped Mantine inputs —
  the locked pattern for all later forms (incl. Phase 1b).

### 5. Out of scope for this version

- Unsaved-changes route guard (deferred — `open-items`): navigating away with
  unsaved edits silently discards them by design for v1.
- Auto-save (that's Screen 5's requirement, not this one).
- Project creation (Screen 2's modal).
- Topology / advanced scope modeling (Screen 5 v2).

---

## Screen 5 — Phase 1b Asset Inventory v1 (Table, read-only)

Wireframe source: slide 7 "5 | Phase 1b — Asset Inventory (Table)" of
`PRIVACT_UI_Screens.pptx` (slide 8 = Topology Canvas v2, out of scope).

**Scope = strict static (Option A).** This screen is split across phases:
- **5a (this spec):** read-only table + types + MSW handlers + states.
- **5b:** interactive edit pane (create/edit, 15-cell ROLFP grid, auto-save,
  delete, live Impact).
- **5c:** Links tab + management.
- **1b v2:** Topology canvas (React Flow).

### 1. What the user sees on load (states)

Chrome (all states): `AppLayout` navbar/avatar + shared `Breadcrumb`
`Projects › {project.name} › Assets & Links` (terminal renamed from
`Assets` in the navigation-polish pass — the page hosts both tabs as
siblings; needs `useProject(id)` for the name + not-found). Tab strip (one row): `Assets` active (navy bg / teal text) +
`Links` **disabled**, tooltip "Coming in Phase 5c"; right of the same row
`+ Add Asset` (teal, prominent) **disabled**, tooltip "Coming in Phase 5b".
Right pane (~30% / ~320px, **inline split — not a Mantine overlay Drawer**):
static placeholder — "Select an asset to view details" + muted "ROLFP impact
scoring coming in Phase 5b". Footer note (italic/small/muted): "ROLFP =
Reputation · Operational · Legal · Financial · Personal (per CIA dimension)".

Left pane (~70%), 4 states:
- **Loading:** skeleton breadcrumb + ~6 skeleton rows.
- **Populated:** table, 4 columns **Name · Category · Resides In · Impact**
  (Impact = `0 / 0 / 0` everywhere in 5a). Counter line under tabs
  (small/dimmed): "{N} assets · 0 links". No row interaction.
- **Empty** (`?empty=1`): informational only — title "No assets yet",
  subtitle "Asset creation will be available in Phase 5b". **No button.**
  Counter line hidden.
- **Error:** `useProject` 404/error → full-page "Project not found" + Back to
  projects (Screen 3/4 pattern). `useAssets` fetch error → in-pane red alert
  + Retry.

### 2. What the user can do

- **Functional:** breadcrumb nav (`Projects` → `/projects`; `{name}` →
  `/projects/:id`); inherited `AppLayout` (logo, logout).
- **Visible-disabled (roadmap signals):** `Assets` tab no-op; `Links` tab
  disabled + tooltip; `+ Add Asset` disabled + tooltip; table rows **no
  interaction** (no click/hover/select/menu); right pane static.
- **Dev affordance:** `?empty=1` URL → MSW returns `[]` → empty state.
- **No Continue/Back inter-phase buttons** (hub + breadcrumb only;
  wireframe-faithful — slide 7 has none).

### 3. Backend endpoints

- Called by 5a UI: `GET /api/v1/projects/:id` (breadcrumb/not-found,
  `useProject`); `GET /api/v1/projects/:id/assets` (table, `useAssets`;
  honors `?empty=1`); `GET /api/v1/catalog/asset-categories` (maps stored
  `categoryId` slug → display label for the Category column).
- Implemented in MSW but **not called by 5a UI** (ready for 5b/5c to wire UI
  only): `POST` / `PATCH` / `DELETE /api/v1/projects/:id/assets`.
- Deferred to 5b: `GET /api/v1/catalog/scales` (ROLFP scale).
- Out of contract now: `PUT /projects/:id/assets` (bulk CSV import).

### 4. What happens on each action

- Load: `useProject(id)` + `useAssets(id)`. Query keys `['project', id]`,
  `['assets', id, { empty }]`, `['catalog','asset-categories']`
  (`staleTime: Infinity`).
- `?empty=1`: `useSearchParams` → hook → request `?empty=1` → MSW `[]`. Does
  **not** delete seed (response short-circuit, same as Screen 2).
- Disabled controls: click = no-op, hover = tooltip.
- Breadcrumb: React Router `<Link>`, no mutation.
- **MSW handler semantics:**
  - `GET …/assets`: `?empty=1` → `200 []`; else `200` stored assets (unknown
    project → `[]`).
  - `POST …/assets`: validate `name` + `categoryId` (∈ 7 slugs); create with
    uuid `id`, `residesIn:''`, `comments:''`, zeroed `rolfp`; persist;
    `201` + asset; `400` if invalid.
  - `PATCH …/assets/:aid`: partial (name/categoryId/residesIn/comments/
    rolfp); `200` + updated; `404` if missing.
  - `DELETE …/assets/:aid`: remove; `204`; `404` if missing.
  - `GET /catalog/asset-categories`: static `{id,label}` ×7; `200`.
- Store: localStorage key `privact_assets_v2`, clean reseed (no migration).
  On load, `console.warn` if legacy `privact_assets_v1` is present: "Stale
  assets store key (_v1) found in localStorage. Safe to ignore; using _v2."
- Mutation verification: documented `fetch()` console snippets in
  `docs/dev-checklists.md` ("Phase 5a manual verification": POST→201,
  PATCH→200, DELETE→204) — reusable for real-backend integration checks.

### 5. Out of scope (→ phase)

- **5b:** edit pane; row interaction + select preview; create flow; 15-cell
  ROLFP grid (reuses `RiskScaleInput` 0–4); live computed Impact
  (`maxPerCia`); editing `comments`/`residesIn`; auto-save (debounced
  `PATCH`); delete-from-pane; enabled empty-state Add button; `GET
  /catalog/scales` usage.
- **5c:** Links tab + management; real "· N links" count;
  asset-delete-with-links semantics (`open-questions`).
- **1b v2:** Topology canvas (React Flow); `residesIn` → FK relationship.
- **Deferred / v1.1:** bulk CSV (`PUT`); sort/filter/search/pagination; real
  backend; a11y/i18n audit.
- **Separate:** Screen 4 footer fix (post-5a atomic commit).

### Types (forward-complete — defined in 5a; 5b/5c add UI only, no reshape)

```ts
export type Rolfp = {
  reputation:  { c: number; i: number; a: number };
  operational: { c: number; i: number; a: number };
  legal:       { c: number; i: number; a: number };
  financial:   { c: number; i: number; a: number };
  personal:    { c: number; i: number; a: number };
};
export type Asset = {
  id: string;
  name: string;
  categoryId: string;   // slug from asset-categories catalog
  residesIn: string;    // free-text in 5a, FK in 1b v2
  comments: string;
  rolfp: Rolfp;
};
export type AssetCategory = { id: string; label: string };
```

Helper `maxPerCia(rolfp): { c; i; a }` = `Math.max` across the 5 dimensions
per axis. 5a: zeroed `rolfp` → `0 / 0 / 0`. 5b: real values, no type change.

7 categories (verbatim, slug `id` → `label`): `database`→Database,
`application-api`→Application/API, `container`→Container,
`container-network`→Container Network, `hardware`→Hardware, `os`→OS,
`tcp-ip`→TCP/IP.

Seed: 12 assets (5 from the wireframe + 7 invented, medical-IoT consistent),
zeroed `rolfp`, localStorage key `privact_assets_v2`.

---

## Screen 5 v2 — Phase 1b Asset Edit Pane + ROLFP grid (5b — interactive)

Builds on the 5a `AssetsPage` shell (committed in `008fbeb`). The split-pane
right side and the disabled `+ Add Asset` / row interactions become
interactive. Links remain in 5c (disabled tab kept).

### 1. States + transitions

Page chrome unchanged from 5a except:
- `+ Add Asset` (top-right): **enabled** (no tooltip).
- Row click: enabled, selected row gets a **teal accent** (~3px border-left).
- Row `Impact` cell: live-updates via cache as the selected asset's ROLFP
  changes (after each successful save, ~610ms after last keystroke).
- Empty-state message: "No assets yet — click + Add Asset above to start"
  (CTA pointer; no duplicate button).
- `Links` tab + tooltip unchanged ("Coming in Phase 5c").

Right pane — **3 states**:
| State | Trigger | Pane content |
|---|---|---|
| **No selection** | initial / after Delete / explicit deselect | Static placeholder: "Select an asset to view details" + muted "Click + Add Asset to create a new one". |
| **Edit existing** | row click | Header (title `asset.name` + save indicator + Delete icon + ✕ close) · Basic fields populated · 5×3 ROLFP grid · Section 3 live Impact badges. Selected row teal accent. |
| **Edit draft** | `+ Add Asset` click | Same layout, fields empty, focus on `Name`. Asset NOT in table until first POST. Delete icon hidden. After first POST → transitions to *Edit existing* for the new id; new row appears in the table. |

### 2. What the user can do (per state)

- **No selection:** row click → Edit existing · `+ Add Asset` → Edit draft ·
  breadcrumb nav · Assets tab no-op · Links tab disabled+tooltip.
- **Edit existing:** edit Name / Category / Resides In / Comments → debounced
  PATCH · edit ROLFP cells → debounced PATCH + live Impact updates · row
  switch (flush-or-discard) · `+ Add Asset` (flush-or-discard) · Delete
  (confirm modal → DELETE) · breadcrumb (flush-or-discard) · ESC / ✕ →
  deselect (flush-or-discard).
- **Edit draft:** type Name + Category → enables first POST · all other
  fields editable, all current values sent with first POST atomically ·
  Delete hidden · row click / `+ Add Asset` (silent discard if invalid,
  save-then-switch if name+cat valid) · ESC / ✕ → silent discard.

### 3. Backend endpoints

- Already wired in 5a (unchanged): `GET /projects/:id`, `GET …/assets`
  (honors `?empty=1`), `GET /catalog/asset-categories`.
- **New 5b wiring** (existing implemented mutations now called from UI):
  `useCreateAsset`, `useUpdateAsset`, `useDeleteAsset`.
- **Contract change**: `POST /projects/:id/assets` body extends to optionally
  accept `residesIn`, `comments`, `rolfp` (defaults applied server-side if
  absent). Enables atomic first-save for drafts (no two-call dance).
- **Cache strategy** (refinement on 5a hooks): the 3 mutation hooks switch
  from `invalidateQueries` → `setQueriesData` (prefix `['assets',
  projectId]`). Avoids refetch storm + race window during auto-save.

### 4. What happens on each action (mechanics)

**Auto-save (the heart of 5b)**
- Debounce **600ms** after last form change (basic field or ROLFP cell).
  Implemented in `src/hooks/useAssetAutoSave.ts`.
- Zod-gated: invalid → indicator "Fix errors to save", no save fires.
- Edit existing → PATCH with full body; server returns updated asset;
  `setQueriesData` rewrites the matching row in cache.
- Edit draft → POST with full body (incl. any touched residesIn / comments /
  rolfp); server returns 201 + asset with id; cache append; state →
  *Edit existing* for the new id; selection stays.
- **AbortController** cancels superseded PATCHes — each new PATCH aborts the
  prior in-flight controller; `AbortError` is filtered out (no false "Save
  failed"). POST is **not** aborted (would orphan a server-side asset).

**Optimistic vs wait-for-server**
- **In-pane Section 3 Impact**: instant (RHF `useWatch` on rolfp).
- **Row's Impact cell**: wait-for-server (cache write on save success); lag
  ~610ms. No revert UX (no true optimistic writes).

**Uniform "flush-or-discard"** on every context loss (row switch · `+ Add` ·
✕ · breadcrumb). Orchestrated by `AssetsPage` via `editPaneRef`: the
`AssetEditPane` exposes `{ flushNow, getStatus }` through
`useImperativeHandle`; `AssetsPage.flushOrDiscardCurrent()` peeks `getStatus`
and:
- Valid + dirty → `await flushNow` (PATCH/POST then proceed).
- Invalid + dirty → emit discard toast `"Unsaved changes discarded
  (validation errors)"`, then proceed (hook's flushNow is a no-op on invalid).
- Pristine → proceed silently.
- Draft + invalid → silent discard (no server state to preserve).
- No `beforeunload` browser guard.

**Pane close affordances**: ✕ icon (header top-right) **and ESC key** both
trigger parent's `onClose` → `handlePaneClose` → same flush-or-discard
path. ESC listener uses **window capture phase** + a `[role="dialog"]` DOM
check so an open delete-confirmation modal handles its own ESC first
without also closing the pane underneath.

**Delete**: Mantine `modals.openConfirmModal` (red destructive) → on confirm
`useDeleteAsset.mutate(id)` → onSuccess: cache filter, return to
*No selection*, toast `"Deleted '{name}'"`. On error: toast + asset stays.

**Error retry**: POST/PATCH fail → indicator `"✗ Save failed"` + Retry
button → re-fires same mutation with current RHF state. No auto-retry.
Form stays dirty until success.

**Save indicator (6 states):** Idle ("All changes saved automatically") /
Unsaved (`⚠ Unsaved changes…` during debounce) / Saving (`<Loader xs/>
Saving…`) / Saved (`✓ Saved` + Tooltip "Saved at HH:MM" via dayjs) /
Invalid (`⚠ Fix errors to save`, orange) / Failed (`✗ Save failed` +
Retry, red).

**Header title:** `asset.name` (Edit existing) / `"New asset"` (Edit
draft) / `"Untitled asset"` fallback.

### 5. Validation (Zod, locked)

```ts
z.object({
  name:       z.string().trim().min(1, 'Name is required'),
  categoryId: z.enum(VALID_CATEGORY_SLUGS),  // 7 verbatim slugs
  residesIn:  z.string(),                    // free-text, no constraint
  comments:   z.string(),                    // free-text, no constraint
  rolfp: /* 5 × { c, i, a }, each = `riskScoreSchema` (shared with CIA) */,
})
```
`riskScoreSchema` is the shared `z.union([z.literal(0)..z.literal(4)])`
exported from `src/lib/scale.ts`; it backs both CIA priorities (SetupPage)
and ROLFP cells (AssetEditPane). Slider `step={1}` + `min/max` clamp at the
UI; Zod is defense-in-depth.

### 6. ROLFP grid layout (as built)

- **5 rows × 3 cols**, implemented as a dedicated `<RolfpGrid>` component
  (`src/components/RolfpGrid.tsx`) — pure controlled input: props
  `{ value: Rolfp, onChange: (next: Rolfp) => void, disabled? }`. Adjusted
  from the original "inline NumberInput, no new component" plan once
  Adjustment 1 split it out for clarity and future reuse (e.g. read-only
  display in Phase 4 dashboards).
- Per cell: `<RiskScaleInput compact />` — slider + adjacent value badge,
  ~24px tall. The `compact?` prop was added to `RiskScaleInput` in 5b
  (Adjustment 2) so the same component backs both CIA priority sliders
  (full mode) and ROLFP grid cells (compact mode).
- Row labels: **initials** `R/O/L/F/P` with Mantine `Tooltip` showing the
  full dimension name on hover. Initials chosen due to right-pane width
  constraint with compact sliders (full names didn't fit alongside three
  cells at the slider widths needed).
- Column headers: `C / I / A`.
- Scale legend (`0 None · 1 Low · 2 Medium · 3 High · 4 Critical`, from
  `lib/scale.ts`) + Section 3 computed Impact badges
  (`Impact: [C 3] [I 4] [A 2]` colored by `riskLevel(v).color`) live in
  `<AssetImpactSection>` (`src/components/AssetImpactSection.tsx`), which
  wraps `<RolfpGrid>` + legend + computed badges. Computed `impact` is
  passed in pre-computed (via `maxPerCia`) so the parent can memoize.

### 7. Out of scope for 5b

- **→ 5c:** Links tab + management, asset-delete-with-links semantics
  (`open-questions`), real "· N links" counter.
- **→ Phase 1b v2:** Topology canvas (React Flow), `residesIn` → FK.
- **→ Deferred / v1.1:** sort/filter/search, pagination, bulk CSV import
  (`PUT`), real backend, a11y/i18n audit.
- **→ Anti-creep (ρητά εκτός):** concurrent-edit conflicts / multi-tab
  sync, `beforeunload` guard, optimistic cache writes + revert UX, undo/
  redo, bulk asset operations, drag-reorder, templates/clone, audit log,
  comments threading, file attachments, asset-level permissions, visual
  polish pass.
- **→ Separately tracked (not forgotten):** shared `ScreenState`
  refactor, route code-splitting, real Keycloak.

### 8. Component structure (as built)

The substantive 5b deliverable is split across 5 new files (Adjustment 1)
plus one extension to an existing component (Adjustment 2):

- `src/pages/AssetsPage.tsx` (edited) — table + selection state
  (`selectedId`, `draftKey`) + `flushOrDiscardCurrent` orchestration via
  `editPaneRef`; renders `<AssetEditPane>` in the right pane.
- `src/components/AssetEditPane.tsx` (new) — RHF form + Mantine inputs;
  delegates auto-save to `useAssetAutoSave`; exposes
  `{ flushNow, getStatus }` via `useImperativeHandle` (React 19 ref-as-
  prop).
- `src/components/AssetImpactSection.tsx` (new) — wraps `<RolfpGrid>` +
  scale legend + computed Impact badges.
- `src/components/RolfpGrid.tsx` (new) — 5×3 controlled grid; 15 instances
  of `<RiskScaleInput compact />`.
- `src/components/SaveIndicator.tsx` (new) — pure presentational, 6 states
  driven by `{ status, lastSavedAt }`.
- `src/hooks/useAssetAutoSave.ts` (new) — auto-save engine (debounce,
  AbortController, POST/PATCH branching, derived `saveStatus`,
  `flushNow`).
- `src/components/RiskScaleInput.tsx` (edited) — `compact?` prop added.

### Types (additive + one narrowing)

```ts
// Type rename: 5a's `CiaScore` → `RiskScore` (now the shared 0–4 union
// backing both CIA priorities and ROLFP cells, per the workbook's "Impact
// Calculation + Scales" sheet). `CiaPriorities` and `Rolfp` cell types
// updated in src/types/project.ts and src/types/asset.ts respectively.
//
// Shared zod schema: `riskScoreSchema = z.union([z.literal(0)..z.literal(4)])`
// exported from `src/lib/scale.ts`; used by both the CIA form and the
// ROLFP cells.
//
// CreateAssetInput extended additively to enable atomic first-POST for
// drafts. Asset / Rolfp / AssetCategory / UpdateAssetInput shapes
// unchanged (only Rolfp cell type narrowed from `number` to `RiskScore`).
export type CreateAssetInput = {
  name: string;
  categoryId: string;
  residesIn?: string;
  comments?: string;
  rolfp?: Rolfp;
};
```

---

## Screen 5 v3 — Phase 1b Links sub-feature (5c)

Enables the `Links` tab that was disabled in 5b. Adds asset-to-asset
connections (undirected, untyped, no metadata) plus the cascade behavior
when an asset is deleted with active links.

### 1. States + transitions

Page chrome changes from 5b:
- `Links` tab is **enabled** (no tooltip).
- `+ Add Asset` button is **contextual**: label switches to `+ Add Link`
  when `activeTab === 'links'`.
- Counter line shows real counts: `{N} assets · {M} links` (was hardcoded
  `· 0 links` in 5b).
- `+ Add Link` is **disabled** when `assets.length < 2` (tooltip: "Need
  at least 2 assets to link").

Tab switch behavior: awaits `flushOrDiscardCurrent()` first (same path as
row switch / +Add / ✕ close — uniform context-loss policy from 5b carries
forward), then clears `selectedId`/`draftKey`, then flips `activeTab`.

Links tab — 4 states:
| State | Trigger | Content |
|---|---|---|
| **Loading** | initial `useLinks` fetch | skeleton list (3-4 rows) |
| **Empty** | `links.length === 0` | "No links yet. Click + Add Link above to start" |
| **Populated** | `links.length > 0` | rows: `{A.name} — {B.name}` + per-row delete button |
| **Error** | fetch failure | red alert + Retry |

### 2. What the user can do

**Links tab:**
- Click `+ Add Link` (page-level, contextual) → opens `<AddLinkModal>`.
- Click per-row delete icon → Mantine `modals.openConfirmModal`:
  "Remove link between {A.name} and {B.name}?" → on confirm, `DELETE`.

**Add Link modal:**
- Two `<Select>` pickers (both required, must differ).
- Live validation against props-passed `assets` + `links` (already cached):
  - `assetIdA === assetIdB` → inline error "Cannot link asset to itself",
    Save disabled.
  - Existing pair → inline error "These assets are already linked", Save
    disabled.
- Submit → `POST` → on 201, modal closes + `setQueriesData` appends. On
  error (400 / network), modal stays open with red alert + inline error.
- Cancel / ✕ / ESC → close, no state change.

**Assets tab (5b behaviors carry forward, with two additions):**
- New "Links" column (5th column) showing per-asset link count — dimmed
  numeric (e.g. `2`) or `—` when zero.
- Asset delete confirmation in `AssetEditPane`: when `linkCount > 0`,
  appends "This asset has N link(s). Deleting will also remove those
  connections." When N === 0, no such line.

### 3. Backend endpoints

New:
- `GET /api/v1/projects/:projectId/links` → `Link[]`
- `POST /api/v1/projects/:projectId/links` body `{ assetIdA, assetIdB }`
  → `201 Link` (or `400` / `409` on validation failures — see below)
- `DELETE /api/v1/projects/:projectId/links/:linkId` → `204`
  (`404` if not found)

Modified:
- `DELETE /api/v1/projects/:projectId/assets/:assetId`: handler now calls
  `removeLinksByAsset` **before** `removeAsset` (mock-transactional).
  Response unchanged (`204` / `404`).

`POST /links` normalization + validation:
- Server normalizes endpoint order: `[low, high] = a < b ? [a, b] : [b, a]`
  (lexical string comparison). Returns the canonical `Link` with
  `assetIdA <= assetIdB`. Error body shape is uniform:
  `{ message: string }`.
- `400` if either `assetIdA` or `assetIdB` is missing
  (`{ message: 'Both endpoints are required.' }`).
- `400` if `assetIdA === assetIdB` (same-id; defense-in-depth even though
  client guards) — `{ message: 'Cannot link asset to itself.' }`.
- **`409 Conflict`** if the normalized pair already exists (RFC 7231 /
  9110 semantics — the request conflicts with current resource state) —
  `{ message: 'These assets are already linked.' }`.

### 4. What happens on each action

- **Add Link submit:** `POST` → on 201, modal closes, `setQueriesData`
  appends to `['links', projectId]`. On error, modal stays open with
  inline + Alert error.
- **Per-link delete:** confirmation modal → `DELETE` → on 204,
  `setQueriesData` filters out. On error, toast "Delete failed" + link
  stays.
- **Asset delete (cascade):** confirmation modal (with conditional
  warning if `linkCount > 0`) → `DELETE` asset → mock handler removes
  related links then asset → on success, BOTH `setQueriesData(['assets',
  projectId])` filter (existing 5b behavior) **and**
  `invalidateQueries(['links', projectId])` (refetch). The invalidate
  ensures the Links tab doesn't show orphaned rows referencing a deleted
  asset.
- **Tab switch:** `await flushOrDiscardCurrent()` → clear `selectedId`/
  `draftKey` → flip `activeTab`.
- **`+ Add Asset` / `+ Add Link` toggle:** same button, label + onClick
  swap based on `activeTab`. Add Link is disabled with tooltip when
  `assets.length < 2`.

### 5. Validation (Add Link modal)

Plain `useState` + computed errors (matches Screen 2's "New Project"
modal precedent; RHF+Zod is the locked pattern for *substantive* forms,
not 2-Select create modals — and the dynamic refine against live cache is
awkward to express in Zod):

```ts
const pairKey = (a: string, b: string) =>
  a < b ? `${a}|${b}` : `${b}|${a}`;
const existing = new Set(links.map((l) => pairKey(l.assetIdA, l.assetIdB)));

const error =
  !assetIdA || !assetIdB
    ? null
    : assetIdA === assetIdB
      ? 'Cannot link asset to itself'
      : existing.has(pairKey(assetIdA, assetIdB))
        ? 'These assets are already linked'
        : null;
// `Save` disabled when error !== null OR either id is empty.
```

### 6. UI design choices (as built)

- **N-links counter** (assets table 5th column):
  `<Badge variant="light" color="gray" radius="sm">{n}</Badge>` when
  `n > 0`; dimmed em-dash `—` when `n === 0`. Badge weight matches the
  density of the `Impact` triple; em-dash matches the `Resides In` empty
  convention.
- **Link list row ordering**: store-insertion order (oldest first).
  Predictable; survives asset renames without reordering.
- **Link list row separator**: `<strong>{A.name}</strong> —
  <strong>{B.name}</strong>` (em-dash between bold names) inside a
  `<Paper>` per row. Ordering of A vs B reflects the **stored lex-
  normalized order** (`assetIdA <= assetIdB`).
- **Asset name fallback** in `LinksTab`: if a stored link references an
  id no longer in the assets list (shouldn't happen post-cascade, but
  theoretically possible during a race), the row displays the asset id
  verbatim instead of crashing.
- **`+ Add` button placement**: page-level, inside the `Tabs` component,
  in a `Group justify="space-between"` row alongside `Tabs.List` (right
  of the tabs). Label switches between `+ Add Asset` and `+ Add Link`
  based on `activeTab`. When `activeTab === 'links'` AND
  `assets.length < 2`, the button is disabled with a Mantine `Tooltip`
  (`"Need at least 2 assets to link"`) using the `<span>` wrapper
  pattern (Mantine convention for tooltip-on-disabled).
- **URL state for active tab**: `?tab=links` in the URL when the Links
  tab is active; absent (or `tab=assets`) for Assets. Survives reload;
  plays nicely with the existing `?empty=1` toggle.
- **Delete-link confirm copy**: "Remove link between {A.name} and
  {B.name}?" + Confirm/Cancel (red destructive).

### 7. Out of scope for 5c

- Link types / labels / metadata.
- Link management from the asset edit pane (only the Links tab manages).
- Search / filter / sort / bulk ops on links.
- Edit existing link (no metadata to edit).
- Topology view / drag-drop link creation (Screen 5 v2, separate later).
- Cross-project links, undo/restore.

### 8. Component structure (as built)

| File | Status | Purpose |
|---|---|---|
| `src/types/link.ts` | new | `Link`, `CreateLinkInput` |
| `src/mocks/linkStore.ts` | new | localStorage per-project links + `normalizePair` + cascade helper (`removeLinksByAsset`) |
| `src/api/links.ts` | new | `listLinks` / `createLink` / `deleteLink` fetch wrappers |
| `src/mocks/handlers.ts` | modified | + 3 link handlers (POST returns 409 on duplicate, 400 on self-link / missing endpoint), asset DELETE cascade |
| `src/api/hooks.ts` | modified | + `useLinks` / `useCreateLink` / `useDeleteLink`; `useDeleteAsset` also `invalidateQueries(['links', projectId])` so the cascade is reflected |
| `src/components/LinksTab.tsx` | new | list view + per-row delete confirm; `+ Add Link` lives in parent |
| `src/components/AddLinkModal.tsx` | new | 2-Select (Mantine `Select` with `searchable`) modal + plain `useState` validation; preserves selections on error for retry |
| `src/components/AssetsTabContent.tsx` | new (extracted) | the existing 5b Grid + table + edit-pane block, lifted out + extended with the `Links` 5th column |
| `src/lib/assetDeleteConfirm.tsx` | new (extracted) | opens the asset delete confirm; appends the cascade warning when `linkCount > 0` |
| `src/components/AssetEditPaneHeader.tsx` | new (proactive split, G3) | extracted from AssetEditPane to keep it under the 260-line cap after the `linkCount` prop wiring landed; pure presentational |
| `src/components/AssetEditPane.tsx` | modified | + `linkCount` prop (optional, default 0); delegates delete to `assetDeleteConfirm`; renders the new `AssetEditPaneHeader` |
| `src/pages/AssetsPage.tsx` | modified | Mantine `Tabs`, `?tab=links` URL state, contextual `+ Add Asset` / `+ Add Link`, tab-switch flush, hosts `AddLinkModal` |

### Types

```ts
export interface Link {
  id: string;
  projectId: string;
  assetIdA: string;  // lex-lower (server-normalized)
  assetIdB: string;  // lex-higher
}

export interface CreateLinkInput {
  assetIdA: string;
  assetIdB: string;  // server normalizes order
}
```

### Seed data

`demo-2` (Hospital IoT Network) gets 3 links between existing assets
(lex-normalized into stored shape):
- `ast-1` (Patient Records DB) ↔ `ast-2` (FHIR API)
- `ast-3` (Edge Node Server) ↔ `ast-6` (FL Aggregator Service)
- `ast-9` (Orchestrator OS) ↔ `ast-11` (Encryption KMS)

Other projects start with no links.

---

## Screen 5 — Phase navigation footer (1b → 2)

Page-level forward affordance on `AssetsPage`, added by the navigation-
polish pass. **Not in the wireframe deck** — see `docs/open-items.md`
"Wireframe deviations" (deck shows no Continue on phase screens; deck
refresh deferred to project-end).

- Right-aligned primary `<PhaseFooter>` CTA "Continue to Phase 2" (teal +
  `IconArrowRight`, matching Screen 4's Save & Continue visual treatment),
  rendered after the Tabs block + AddLinkModal, above the ROLFP legend
  caption (the legend stays the final line). Visible on **both** the
  Assets and Links tabs (lives at page level, not in tab content).
- **Disabled** when `assets.length === 0` (Phase 2 needs assets to compute
  applicable threats/vulns; links are optional, do not block). Tooltip
  while disabled: "Add at least one asset to continue".
- On click → `flushOrDiscardCurrent()` (same flush-or-discard path as tab
  switch / ✕ close) → `navigate('/projects/:id/review')`.
- `PhaseFooter` (`src/components/PhaseFooter.tsx`) is shared — Screens 6-10
  reuse it with the same pattern when built.

Page-scope clarity (folded into the same pass, from the browser sweep):
- **Breadcrumb terminal** renamed `Assets` → **`Assets & Links`** — the
  page hosts both tabs as siblings under one phase activity; matching only
  one tab implied "Assets only" and muddied what Continue covers.
- **Subtitle** between Breadcrumb and Tabs (`<Text c="dimmed" size="sm"
  mb="md">`), verbatim: "Define your project's assets and their
  relationships. Links are optional." — tells the user the page covers
  both and that links don't block Continue.
- Tab labels (`Assets` / `Links`), Continue text, and the disabled tooltip
  are **unchanged**.

## Screen 6 — Phase 2 Threats & Vulnerabilities Review

Built (Commit 2, on top of the Commit 1 MSW per-domain handler extraction).
`src/pages/ReviewPage.tsx` is the orchestrator; tab/filter/table/modal logic
lives in `ReviewTab`, `ReviewFilters`, `ReviewDrillModal`, with pure helpers
in `src/lib/reviewFilter.ts` and the two page-state cards in `ReviewStates`.

**Data model** (`src/types/threat.ts`): `ApplicableThreat` / `ApplicableVuln`
— engine-matched per project. `included` defaults to `assetCount > 0` at seed
time; user toggles per row to refine. `threatId`/`vulnId` reference catalog
entries (`TH-XX`/`VU-XX`).

- **F1 (data-model extension, approved):** beyond the originally-locked field
  list, both types carry `description`, `sourceRef?: { label, url? }`,
  `assetCategories: string[]`, `relatedIds: string[]`. These are the minimum
  needed for the spec's own UI (Asset-Category filter + drill-in modal content
  + cross-domain related items). Logged as a backend-confirm assumption in
  `docs/open-questions.md`.
- **F2:** `cia` is `('C'|'I'|'A')[]`; the CIA filter matches an item whose
  array contains the selected dimension.
- **F3:** the Type filter shows on the Threats tab only (vulns have no
  `type`) — 4 filters on Threats, 3 on Vulns.
- **F4:** seeded under `demo-2` only (the sole project with assets); other
  projects render the defensive-empty state.

**Endpoints** (mock; see `docs/backend-endpoints.md`): `GET` + `PATCH` for
`applicable-threats` and `applicable-vulnerabilities`. Seed: 12 threats + 18
vulns matched to `demo-2`'s 12 assets (realistic, not the wireframe's 42/71);
1 threat + 2 vulns are non-applicable (`assetCount 0`) to exercise the toggle.

**UI:**
- Breadcrumb terminal **"Threats & Vulnerabilities"** (page-scope-clarity
  pattern from Screen 5 — terminal reflects the whole page, not one tab).
- Subtitle: "Review what the engine matched against your assets. Toggle items
  in or out of scope before generating the risk triplets."
- Tabs **"Threats (N)" / "Vulnerabilities (N)"** where N = **in-scope count**
  (`included === true`) from query data — **independent of the "Applicable
  only" view filter** (N reflects Phase 3 generation economy, not the visible
  rows). Active tab persisted in `?tab=vulnerabilities`.
- Filter dropdowns + a **"Applicable only"** Switch (default ON; ON hides
  `assetCount === 0` items — OFF reveals them but never the full catalog).
  All filtering client-side.
- Per-row Mantine `Switch` (in/out) → immediate wait-for-server PATCH →
  `invalidateQueries`. No optimistic update (matches established pattern;
  optimistic logged in open-items). Row Switch + modal Switch share one
  mutation path; the in-flight row's Switch is disabled (`pendingCatalogId`)
  so they can't double-fire.
- Click row body (anywhere but the Switch) → drill-in modal.
- `PhaseFooter` **"Continue to Phase 3"** — disabled until ≥1 threat AND ≥1
  vuln in-scope; disabled tooltip "Mark at least one threat and one
  vulnerability as in-scope". Click → `/projects/{id}/triplets`.

**States:** per-tab loading skeleton; **defensive empty** (0 assets) — "Set up
assets first to see applicable threats and vulnerabilities" + "Go to assets"
button → `/assets` (page-level, replaces tabs); **engine empty** (assets exist,
0 matched) — per-tab "No applicable {threats|vulnerabilities} matched…";
**error** — per-tab retry card.

**Drill-in modal** (`ReviewDrillModal`, Mantine `size="lg"`, centered):
top in/out Switch, description, source ref (link if `url`), CIA badges,
affected asset categories, related items (threat → vulns it can exploit; vuln
→ threats targeting it). Resolves entirely from cached query data (the
ReviewPage passes the resolved item + the opposite domain's name map) — **zero
extra fetch**. Closes on X / ESC / backdrop (Mantine defaults).

## Screen 7 — Phase 3 Triplets & Risk Scoring

Built. `src/pages/TripletsPage.tsx` orchestrates; table/filters/stats/modal/
pagination live in `Triplets*` components, page-state cards in `TripletsStates`,
pure math in `src/lib/riskComputation.ts`, generation in
`src/lib/tripletGenerator.ts`, server-side query sim in
`src/lib/tripletFilter.ts`.

**Generation — on-demand.** User triggers `POST /compute`; pre-compute state
shows a CTA. MSW resolves inline; the real backend will be async (polling per
`backend-integration-playbook.md` §4.1, deferred). Determinism: triplet id =
`TR-${projectId}-${assetId}-${threatId}-${vulnId}` → identical inputs yield
identical triplets (stable keys/cache).

**Formula** (per `risk-engine-logic.md`), per CIA dimension:
`Applicability_dim = (dim ∈ threat.cia ∩ vuln.cia) ? 1 : 0`;
`AssetImpact_dim = max ROLFP cell in that column (0–4)`;
`Risk_dim = Applicability × AssetImpact × ThreatProbability(0–4) × VulnSeverity(0–5)`.
`RiskScore = max(Risk_C, Risk_I, Risk_A)` (range 0–80). Bands: **Low 0–8 ·
Medium 9–29 · High 30–80**. All of `riskC/riskI/riskA/riskScore/band` are
stored on the triplet.

**Generation algorithm** (MSW `/compute`): for each in-scope threat × asset
whose category ∈ `threat.assetCategories`, for each of `threat.relatedIds`
that is an in-scope vuln also applying to that asset's category, emit one
triplet. Reads in-scope items from `applicableStore` (`included === true`),
assets from `assetStore`; writes `tripletStore[projectId]` + a `RiskSummary`
with `lastComputedAt`.

**Endpoints** (4 new; see `backend-endpoints.md`): `GET /triplets` (paginated +
filtered + sorted, server-side), `GET /triplets/:tid` (defensive single-fetch,
rarely hit — modal uses cached row), `GET /risk-summary` (project totals,
**never filtered**), `POST /compute` → `{ status:'done', computedAt }`.

**Four states** (routed off `risk-summary`): **pre-compute** (`lastComputedAt
=== null`) — `ComputePromptCard` CTA; **computing** — compute button shows
loading; **computed + triplets** (`total > 0`) — stats cards + filter bar +
table + pagination + a recompute `ActionIcon` (tooltip "Re-run after changing
assets or in-scope items"); **computed + zero** (`lastComputedAt != null &&
total === 0`) — `TripletsEmpty` + Recompute.

**Table/filters/pagination:** columns Asset · Category · Threat · Vulnerability
· C/I/A · Score · Band; sortable headers (asset/threat/vuln name, score, band).
Filters: band segmented (All/High/Medium/Low), asset single-select, min-risk
slider 0–80 (commits on release). Pagination: 25/50/100 page-size selector,
prev/next, page-number input. Defaults `page_size=50`, `sort=risk_score`,
`order=desc`. **All filter/sort/page state persisted in URL query params**
(refresh-safe, deep-linkable); `keepPreviousData` for flash-free paging.

**Stats vs filters:** the four stats cards come from `/risk-summary` (project
totals) and stay constant as the table filters change — same intent as Screen
6's in-scope tab counts.

**Detail modal** (`TripletDetailModal`, ~700px, X/ESC/backdrop): asset / threat
/ vuln summary cards + a per-dimension worked-example breakdown
(applicability × impact × probability × severity = risk, max-row highlighted) +
score/band. Renders entirely from the cached row — zero extra fetch. Close-only;
the mitigation jump is deferred to Screen 8.

**Phase footer** "Continue to Phase 4: Mitigation Planner" — enabled iff
`total > 0 && lastComputedAt != null`; disabled tooltip "Compute risk triplets
first"; click → `/projects/{id}/mitigations`.

**Seed note:** Phase 3 added `defaultProbability` (0–4) per threat and
`defaultSeverity` (0–5) per vuln (`threatSeed`/`vulnSeed`), and **non-zero
ROLFP** on the 12 `demo-2` assets (`assetStore`, key bumped `_v2`→`_v3`) so the
engine yields a real band spread (zeroed impact → every triplet scores 0). For
`demo-2` this produces 75 triplets (≈32 High / 39 Medium / 4 Low).

**Staleness banner** (`StalenessBanner`): a per-project `scopeVersion` counter
(`Project.scopeVersion`) is bumped by every scope-affecting mutation — asset
POST/PATCH/DELETE (cascade delete bumps once), link POST/DELETE, and
threat/vuln inclusion PATCH. `RiskSummary.computedScopeVersion` records the
version compute ran against. `isStale = lastComputedAt !== null &&
project.scopeVersion > summary.computedScopeVersion`. When stale, a
non-dismissable amber `Alert` ("Triplets may be out of date" / "Your project
scope has changed since the last computation." + "Recompute now") renders at
the top of the content area, above the stats cards — in **both** the
computed+triplets and computed+zero states, but **not** pre-compute (no
triplets to be stale yet). "Recompute now" reuses the same `useComputeTriplets`
mutation as the toolbar recompute icon; on success the summary refetches with
the current version and the banner clears. Resolves the deferred Q5 staleness
gap (aligns with the "no thinking required on each screen" principle). The
scope-versioning contract is implementation-specific — see open-questions.

## Screen 8 — Phase 4a Mitigation Planner (★ showcase)

> **SUPERSEDED (v3 C8/C9c).** Describes the v2 multiplicative-residual planner;
> `MitigationsPanel*`/`MitigationDetailModal`/`CatalogItemRow` were DELETED in
> C9c. v3 Mitigations are D3FEND-anchored (severity-recompute). NOTE:
> `residualComputation.ts` + `mitigationStore.ts` were KEPT (still consumed by the
> v2 triplet pipeline) — see `docs/open-questions.md` "v2 triplet pipeline
> retirement". Current behavior: `docs/v3-blueprint.md` C8.

Built. `src/pages/MitigationsPage.tsx` orchestrates; table/panel/action-bar/
picker live in `Mitigations*` + `CatalogItemRow`, page-state cards in
`MitigationsStates`, residual math in `src/lib/residualComputation.ts`,
selection + applicability + residual helpers in `mocks/data/mitigationStore.ts`.

**Layout (Q1):** list + side-panel drill-in. Paginated table at
`/projects/:id/mitigations` — columns select · Asset · Threat · Vulnerability ·
Original · Residual · Reduction · Status. Click a row → a right-anchored Mantine
`Drawer` (~550px, persistent editing context, X/ESC/backdrop close) — not a
modal. Leftmost checkbox column (header selects current page) + a sticky action
bar for bulk.

**Residual (Q2, closes open-question #1):** `residual = round(original ×
Π(1 - r_i))` — multiplicative, single pool (controls + countermeasures),
score-level uniform, floored at 0, same bands as Phase 3. Catalog-seeded
`defaultReduction` per entry (0.1–0.7). Server-side authoritative; the frontend
never computes residual.

**Applicability (Q3):** engine matrix. Each catalog entry has
`applicableAssetCategories` (category ids) + `applicableVulnIds`; an entry
applies to a triplet iff the triplet's asset-category id AND vuln id are both
listed. Filtered server-side; the response is denormalized (full applicable
items, no client join). Mock catalog: 70 controls (30 NIST CSF + 40 CIS v8) +
50 MITRE D3FEND countermeasures; per-triplet applicable ≈ 8–18.

**Live recompute (Q4):** hybrid optimistic. Clicking a checkbox flips it
instantly via TanStack Query `onMutate`; a full-state PATCH
`{ selectedControlIds, selectedCountermeasureIds }` fires (no delta, no
debounce, last-write-wins); the server response merges the authoritative
`residualScore`/`residualBand` (`onSuccess`); errors roll back + toast. An
in-flight spinner shows near the residual during the PATCH.

**Bulk apply (Q5):** ephemeral multi-select (component `Set`, not URL; clears on
page/sort change + navigation). Action bar appears at ≥1 selected:
"N selected · Apply control… · Apply countermeasure… · Clear". The picker modal
(single-select, search, client-paginated) shows a per-row "K of N" applicability
indicator (server-computed via `GET /mitigations/picker`); confirm → bulk PATCH
→ toast "Applied X. Skipped Y (not applicable)." → list refreshes, selection
clears. One bulk action = one entry type.

**List residual:** `GET /triplets` enriches each page item with
`residualScore`/`residualBand`/`mitigationCount` from the mitigation store, so
the table renders without N per-triplet fetches (Screen 7 ignores these).

**Staleness:** the Screen 7 `StalenessBanner` is reused above the table (same
`scopeVersion > computedScopeVersion` logic); "Recompute now" reruns
`/compute`. Triplet-reference orphans (after a recompute changed ids) are
handled defensively — the per-triplet endpoint 404s and the list only shows
current triplets.

**States:** project-error card; needs-compute card (→ Triplets) when no
triplets exist; loading skeletons. **Phase footer** "Continue to Phase 4b:
Dashboard" → `/projects/{id}/dashboard` (enabled iff triplets exist).

**Endpoints (6, inventory 23→29):** `GET /catalog/controls`,
`GET /catalog/countermeasures`, `GET`/`PATCH /triplets/:tid/mitigations`,
`GET /mitigations/picker` (new — K-of-N), `PATCH /mitigations/bulk`.

**Pagination reuse:** `TripletsPagination` is reused directly (no
`MitigationsPagination` duplicate); a shared-component extraction is logged in
open-items.

## Screen 9 — Phase 4b Dashboard

> **SUPERSEDED (v3 C9a/C9c).** The v2 dashboard handlers (`risk-heatmap`,
> `top-residual`) were DELETED in C9c. v3 Dashboard reads the LIVE residual model
> client-side (`useResidualModel`, `buildHeatmapV3`). Current behavior:
> `docs/v3-blueprint.md` C9a.

Built. `src/pages/DashboardPage.tsx` orchestrates; the SVG heatmap is
`RiskHeatmap`, KPIs `DashboardKpiStrip`, top list `TopResidualList`, view toggle
`HeatmapToggle`, page-state cards `DashboardStates`. Aggregation in
`src/lib/heatmapAggregation.ts`, axis/slug derivation in `src/lib/threatTypes.ts`.

**Layout (Q1):** vertical stack, single column — staleness banner · KPI strip
(4 cards) · heatmap (full width) · top residual list (10 rows). No side panels
at MVP.

**Heatmap (Q2/Q3):** custom inline **SVG** (no charting dependency — closes the
Plotly/D3 open-question). Y = 7 asset categories, X = threat types derived from
`threatSeed` (`nefarious_activity`, `unintentional_damage`, `outages`,
`eavesdropping_interception`, `physical_attack`, `disaster` — 6 columns for the
current seed). Cell = **max score** in that (category, threat-type) combo for
the active view; band-colored (Low green / Medium amber / High red, same palette
as Screens 7/8); empty cells = grey "—", inert. Per-cell Mantine Tooltip (4
lines: label, count, max·avg, mitigated) + `<title>` for a11y. Marginal totals
(row/column triplet counts) dimmed at the right/bottom edges. Responsive width
via `useElementSize`; horizontal scroll below min cell width. **Residual/Original
toggle** (segmented, default Residual) recomputes cell values.

**Drill-down (Q4):** click a filled cell → `/triplets?asset_category=<slug>&
threat_type=<slug>`. Screen 7 filters server-side (slugified match on both
sides) and shows a blue **"Filtered from dashboard: <Category> × <Type>"** alert
with a close button that clears only those two params (preserving band/min_risk
etc.). The Reset button clears them too. Empty cells are not clickable.

**KPIs (Q5):** 4 cards from the enriched `RiskSummary` — Total triplets
(neutral), Mitigation coverage % with `mitigated/total` subscript (blue),
Overall reduction % (teal/success), High residual count (red/danger).
`RiskSummary` gained `mitigatedCount`, `totalReductionPercent`,
`highResidualCount` (computed from triplets × mitigation selections).

**Top residual list:** 10 triplets sorted by residual desc; columns Asset+cat,
Threat+id, Vuln+id, Original, Residual+band chip, Reduction %. Click a row →
`/mitigations?triplet=<tid>` — **Screen 8 deep-link** fetches that triplet
(`GET /triplets/:tid`, may be off-page), auto-opens its mitigation drawer, then
clears the `?triplet` param (render-time promote into panel state + an effect
that only navigates — no re-trigger on close/navigation).

**Endpoints (2 new, inventory 29→31):** `GET /risk-heatmap?view=`,
`GET /risk-summary/top-residual?limit=`. **2 extensions:** `/risk-summary` +3
KPI fields; `/triplets` +`asset_category`/`threat_type` filter params.

**Staleness:** Screen 7 `StalenessBanner` reused above the KPI strip;
"Recompute now" reruns `/compute`, which now also invalidates the heatmap +
top-residual queries so the whole dashboard refreshes in place.

**Phase footer** "Continue to Phase 4c: Export" → `/projects/{id}/export`
(Placeholder until Screen 10). Always enabled — the dashboard is read-only.

## Cross-cutting — PhaseNav (bidirectional phase navigation)

Shipped alongside Screen 9. A consistent phase strip (`PhaseNav`) mounts at the
top of all project-scoped pages (Setup, Assets & Links, Review, Triplets,
Mitigations, Dashboard — Export remains a Placeholder), immediately after the
breadcrumb. The breadcrumb is trimmed to "Projects / {project}" (the trailing
page name is now shown highlighted in the strip). Phase order/labels/paths come
from `src/lib/phaseRoutes.ts` (single source of truth).

`PhaseFooter` gained an optional `previousPhase` prop → a left-aligned
secondary "← Back to {phase}" outline button beside the primary forward
"Continue" button (space-between when both present; flex-end when Continue-only,
preserving prior behavior). Setup has no Back (first phase); Export would have
no Continue (terminal). See `working-agreement.md` "Phase navigation principle
(bidirectional)" for the full rationale.

## Screen 10 — Phase 4c Export

> **SUPERSEDED (v3 C9b/C9c).** The v2 export handlers (`report-preview`,
> `report.*`, `report.cyclonedx.json`, `report.oscal.json`) + `downloadHelpers`
> were DELETED in C9c. v3 generates all formats in-browser from the live model
> (`clientDownloads`, `lib/export/cyclonedxV3` + `oscalV3`). Current behavior:
> `docs/v3-blueprint.md` C9b.

Built (replaces the `/export` Placeholder). `src/pages/ExportPage.tsx`
orchestrates; sections live in `src/components/export/sections/*`, sidebar +
header in `src/components/export/`, the report aggregation in
`src/mocks/handlers/exports.ts` (`buildReportPreview`), and the
download-blob/scroll-spy utilities in `src/lib/{officeBlobs,downloadHelpers,
scrollSpy}.ts`.

**Pattern (Q1):** preview-first HTML render + 3 sync direct downloads
(PDF/XLSX/JSON). **Layout:** two-column — left sticky TOC sidebar (~240px,
scroll-spy highlight, `visibleFrom="md"`) + right scrollable main with 8
sections top-to-bottom. **Density (Q3):** summary + top-N per section (full
data only in downloads); no virtualization.

**Sections (8):** Executive Summary · Asset Inventory (top 20 by max ROLFP) ·
Threats in Scope (full) · Vulnerabilities in Scope (full) · Risk Heatmap
(reuses Screen 9 `RiskHeatmap` **unchanged**, own view toggle + query) · Risk
Register (top 20 by residual) · Mitigations Applied (top 10 by reduction
contribution) · Summary Metrics (KPIs). The TOC mirrors this list
(`reportSections.ts` = single source).

**Downloads (Q4):** `GET /projects/{id}/report.{ext}` → blob → anchor click →
`URL.revokeObjectURL`. Filename `{slug}-risk-report-{YYYY-MM-DD}.{ext}`. Each
button has an independent in-flight state. JSON = serialized
`ReportPreviewResponse`; PDF/XLSX = valid placeholder docs built in-code
(`officeBlobs.ts`, no deps) — real generation deferred to backend.

**Gating (Q5):** Phase 3 (triplets computed) is a **hard gate** — full-page
`ExportEmptyState` ("Go to Triplets") when `lastComputedAt === null` or
`totalTriplets === 0`. Phase 4a (mitigations) is a **soft amber banner** when
`mitigationsApplied.total === 0`. Stale state reuses `StalenessBanner` (above
the header); downloads stay enabled. While the preview query loads, a skeleton
shows (never the empty state — avoids flash). PhaseNav stays mounted above the
gate.

**New endpoint:** `GET /report-preview` (+ MSW handlers for the 3 downloads,
which had no prior handlers). Scroll-spy: `useScrollSpy` (IntersectionObserver,
`rootMargin '-20% 0px -75% 0px'`); TOC click → `scrollIntoView({behavior:
'smooth'})` with `scroll-margin-top` on sections.

**Terminal footer:** `PhaseFooter` with `previousPhase` only (Back to
Dashboard) and no `label`/`onClick` → Back-only, no Continue (Phase 4c is last;
`PhaseFooter` made label/onClick optional to support this, backward-compatible).

## Cross-cutting — PhaseNav status dots (iteration 2)

Each PhaseNav pill carries a 7×7 status dot (left of the label) with a thin
white outline for cross-background visibility, plus a status-aware tooltip.
3-state encoding: **grey** = empty (no data), **teal** (`#2DD4BF`) = has-data,
**amber** (`#F59E0B`) = stale. Statuses come from the pure
`src/lib/derivePhaseStatuses.ts` composing `GET /projects/:id`'s new `counts`
field with `GET /risk-summary` (PhaseNav calls both via the existing
`useProject` + `useRiskSummary` hooks; same cache keys, so no extra fetches on
pages that already use them). While those queries are pending/errored, no dots
render (the strip is identical to iteration 1 — graceful degradation).

Semantics (locked): Setup teal when CIA set; Assets teal when ≥1 asset; Review
teal when ≥1 in-scope threat AND ≥1 in-scope vuln; Triplets/Dashboard/Export
empty until computed (and `total > 0`), teal when current, amber when stale
(`scopeVersion > computedScopeVersion`); Mitigations teal when `mitigatedCount
> 0` and current, amber if stale, else empty. Real-time via existing query
invalidation on mutations.

**Setup caveat:** CIA priorities are never null in the current model (a new
project defaults to Medium/Medium/Medium), so Setup's dot is **always teal** —
there is no reachable empty Setup state until the model gains a nullable /
"reviewed" CIA signal. (Deviation from the sweep's grey→teal Setup expectation;
flagged at build time.)
