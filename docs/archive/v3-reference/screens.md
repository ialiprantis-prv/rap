# Screens (v2.0)

High-level inventory of all screens. Detailed UI specs in `docs/screen-specs.md`.

## Project-scoped screens (under `/projects/:id/`)

### Phase 1 — Setup

Project metadata + CIA priorities + Threat Actor Profile (NEW in v2 commit 09 — 4-card ENISA-categories selector inline in the Setup form via `src/components/setup/ThreatActorProfileSection.tsx`). Doubles as the project Settings page.

### Phase 1b — Assets & Links

Asset inventory + asset-to-asset relationships. **Type column** shows the CycloneDX 1.6 component vocabulary (12 standard types: `application`, `library`, `framework`, `container`, `platform`, `operating-system`, `device`, `firmware`, `file`, `data`, `machine-learning-model` + 1 PRIVACT extension `cryptographic-asset`; full list in `src/types/cyclonedx.ts`). Header buttons: **Add Asset** + **Import BOM** (CycloneDX 1.4 / 1.5 / 1.6, NEW in v2 commit 06). Asset edit via centered modal (1000px desktop, 90vw tablet, fullscreen mobile — `AssetEditModal.tsx`) with two-column layout: Identification + ROLFP grid (15-cell). Service edit is the same shape on the services collection. Auto-save was retired in v2 commit 04 → explicit Save + Cancel.

### Phase 2 — Review

Three tabs (NEW third tab in v2 commit 14):

1. **Threats** — ENISA 2022 hierarchy filter (12 top + 25 sub categories, commit 08), Threat Actor chips (commit 09), Source filter (Deliberate / Accidental).
2. **Vulnerabilities** — CWE Pillar filter + CWE hierarchy badges on rows (commit 07), CVSS chips (commit 01).
3. **Per-Asset Applicability** (commit 14) — override the category-based applicability default per `(asset, threat|vuln)` pair. Asset+Service selector dropdown → two list panels (threats + vulns) with Inherited / Overridden badges + override menu. Save & recompute triggers an inline triplet regen.

### Phase 3 — Triplets

Compute + browse triplets (server-side paginated, ~5k row scale). `TripletDetailModal` shows:

- CWE breadcrumb on the vuln side (commit 07).
- ENISA breadcrumb on the threat side (commit 08).
- Threat Actor chips (commit 09).
- **CVSS Environmental Adjustment** section (NEW in v2 commit 13) — opens collapsible per-triplet override. Modified Base Metrics + CR/IR/AR Security Requirements feed a faithful CVSS 3.1 Environmental calculator (`src/lib/cvssEnvironmental.ts`). Derived 0-5 PRIVACT severity replaces catalog severity in the risk formula **for that triplet only**. A `★` marker appears on the TripletsTable row and modal footer when an override is active.
- Bidirectional PhaseNav strip + PhaseFooter Continue/Back affordances.

### Phase 4a — Mitigations

Mitigation application planner. Three framework filters (NEW in v2 commit 10) live in `src/components/standards/ActionFrameworkFilters.tsx` and render alongside the bulk picker: **NIST Function** (CSF v2.0), **CIS Control** (v8 Safeguards), **D3FEND Tactic**. Action rows show framework chips inline (CSF / CIS for Controls; D3FEND for Countermeasures — controls are NIST OR CIS, never both; countermeasures are D3FEND-only). Residual risk recomputes live via the multiplicative single-pool formula in `src/lib/residualComputation.ts`.

### Phase 4b — Dashboard

KPI cards (total triplets, high-risk before/after, mitigation coverage, total reduction %), Asset-Category × Threat-Type heatmap (Residual / Original toggle), top-10 residual list. Bidirectional PhaseNav + drill-down via slugified `asset_category`/`threat_type` URL params.

### Phase 4c — Export

**Five download buttons** (`src/components/export/ReportHeader.tsx`):

1. **PDF** — formal deliverable for EU reviewers.
2. **XLSX** — analyst-friendly spreadsheet.
3. **JSON** — machine-readable structured output.
4. **CycloneDX** 1.6 (NEW in v2 commit 02; carries `x-privact:applicability-overrides` on the project component when set).
5. **OSCAL** 1.1.2 Assessment Results (NEW in v2 commit 12; emits EXAMINE Observations per applicability override + `characterizations` blocks for env-overrides).

Sidebar TOC + sectioned report preview. Optional finalize endpoint exists in the contract but not currently triggered by Export.

## Global screens (outside `/projects/`)

### Login

Authentication entry. Animated navy background, Keycloak OIDC button (stubbed to `localStorage.privact_logged_in`).

### Projects list

Browse all projects. Search, sort, row menu (Open / Delete; Duplicate + Share are backend-pending placeholders).

### Project Overview / Wizard Hub

Read-only entry into a project. Header card + 4-phase Mantine `Timeline` (not Stepper — phase status doesn't map to linear-active) + summary stat grid.

### Standards Catalog (Screen 11, NEW in v2 commit 11)

Global standards encyclopedia at `/catalog`. 4 domain tabs (Assets / Vulnerabilities / Threats / Actions) with sub-tabs for multi-framework domains (CWE on Vulnerabilities; ENISA + STIX on Threats; NIST + CIS + D3FEND on Actions). Hierarchical tree + detail panel + search bar. Shows usage stats per catalog entry by referencing seeded triplet data.

## Universal patterns

- Persistent breadcrumb on every screen (user never feels lost).
- `PhaseNav` strip immediately under the breadcrumb on all project-scoped phase pages (free navigation, not linear-forward).
- `PhaseFooter` retains the primary forward CTA + optional `previousPhase` for backward iteration. Setup has no back; Export has no forward.
- Color-coded risk bands (red / amber / green) — one place where loud color is good.
- Server-side pagination for any list > 100 items.
