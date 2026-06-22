# Open Items (as of v2.0 — sweep phase)

## Polish needs (sweep findings — user populates as the v2 preview is reviewed)

_Empty initially — user will populate as the stakeholder review window and self-sweep surface issues. Atomic-commit per item or batched logically._

## Known limitations (v2.0 baseline)

- **CVSS Environmental calculation is CVSS 3.1-style approximation.** For CVSS 4.0 vectors, the calculator applies the 3.1 formula against AV/AC/PR/UI/C/I/A letters; 4.0-only fields typed but not consumed. UI labels it "PRIVACT environmental approximation"; for authoritative scores users should use first.org's calculator. See `docs/open-questions.md`.
- **Imported CycloneDX BOMs without `x-privact:rolfp` properties default ROLFP to all zeros.** User must edit each post-import. Commit 06.
- **Triplet recomputation on applicability override save:** mitigations attached to no-longer-applicable triplets are stored as orphaned (mitigations re-activate on override revert). Acceptable for the mock; backend may want explicit re-map or surfaced affected selections.
- **ENISA external links** — per-ID deep links don't exist; UI points to the general taxonomy page with a tooltip explanation.
- **Empty / edge state coverage** — needs a polish pass in the current D (Polish) phase.
- **Mobile UX** — drawer → modal migration in commit 05 had limited mobile sweep; needs targeted review.
- **`PerAssetApplicabilityTab.tsx` at 320 lines** exceeds the 260 hard cap. Flagged but accepted as-is — one cohesive tab body with two symmetric list blocks; extraction would split sibling code that reads better together. Revisit if another row type is added.

## Deferred features (not in immediate plan — see `docs/next-phase-plan.md`)

- **Custom vulnerability / threat / action creation UIs** (planned in F partial × 3, after E backend prep).
- **Multi-project comparison** views.
- **Project templates** / risk profiles ("Start from medical IoT template").
- **Risk trend over time** / historical snapshots.
- **Multi-user collaboration**.
- **i18n** (Option G — likely EN+EL).

## Auth & Security (CRITICAL before production)

- **Real Keycloak integration** — replace `localStorage.privact_logged_in` stub with OIDC redirect, token storage, refresh, logout. Requires consortium realm credentials. Blocks production.
- **MFA UI handling** — verify Keycloak realm handles MFA at the auth layer; no extra UI on our side.
- **GDPR consent / Terms of Service acceptance** — likely required before EU deployment. Where: probably on first-time login post-Keycloak.
- **Session timeout / re-auth flow** — graceful redirect to login with "Session expired" message when token expires mid-session.
- **Audit logging** — backend handles, frontend ensures actions are traceable.

## Accessibility

- **Full WCAG 2.1 AA audit** — required for EU deployment. axe-core or equivalent. Per-screen audit + fixes.

## Visual / Branding

- **Animated SVG logo** — replace static wordmark when consortium provides brand guidelines.
- **Custom domain on Vercel** — replace the preview URL with a consortium-provided domain (e.g. `privact.eu`).

## Risk engine UX

- **Re-compute warning banner** on Triplets / Dashboard when CIA priorities or assets changed since last compute. ("Your CIA priorities changed since last compute — results may be stale. [Re-compute now]").
- **Auto-recompute on asset changes** — decision deferred; user-driven for v2.
- **Phase 2 suppression** — allow user to mark threats/vulns as "out of scope" with comment. Requires backend.
- **Phase 2 optimistic inclusion toggle** — currently wait-for-server PATCH → `invalidateQueries`; optimistic update is a polish item; apply consistently across Screens 6-8 if adopted.
- **Phase 4 mitigation-output staleness** — apply the Phase 3 `scopeVersion` pattern to Phase 4: stale mitigation/residual output when triplets are recomputed after mitigations were chosen. Wire an equivalent staleness signal into Screen 8.
- **Phase 3 async compute polling** — MSW `POST /compute` resolves inline; real engine will be async. Implement the job-submit + poll loop per `docs/backend-integration-playbook.md` §4.1 at integration time (the `useComputeTriplets` mutation is the seam).
- **Phase 3 mitigation jump-link** — "Plan mitigations for this triplet" action from the triplet detail modal into Screen 8; deferred.
- **Phase 3 page-size selector placement** — 25/50/100 selector sits in the pagination footer; revisit if usability testing prefers it near the filters.

## Project list & navigation

- **Project Import from JSON** — reconstruct a project from a previously-exported JSON. Use cases: disaster recovery, project cloning, cross-instance migration. New endpoint `POST /projects/import`, file-upload UI, backend reconstruction logic. Flag to backend team: keep JSON export schema reversible.
- **Project Duplicate** — backend feature needed. UI placeholder exists in row menu.
- **Project templates** ("Start from medical IoT template") — deferred.
- **Project sharing / shareable links** — UI hook exists ("Copy shareable link" in Export popover, currently shows "coming soon" toast). Backend feature needed for read-only public view of reports.
- **Bulk actions** on project list — deferred.
- **Project archiving** (separate from delete).
- **CSV export of project list** (separate from per-project report export).

## Browser / device

- **Mobile responsive polish** — functional only for v2; full mobile design later if needed.
- **Browser support for Safari** — test and fix if institutional users need it.

## Observability

- **Sentry / error tracking** — add before production launch.
- **Analytics** (privacy-respecting, e.g. Plausible) — optional; coordinate with consortium.

## Performance

- **Route-based code-splitting** — DEFERRED until all screens (1-11) are built (now done). Apply in one consistent pass:
  - Convert each page in `src/App.tsx` to `React.lazy(() => import('./pages/...'))` behind a single `<Suspense fallback={<Loader/>}>`.
  - Keep `AppLayout` eager; lazy-load the Login route too (`framer-motion` + `NetworkBackground` should not be in the entry chunk).
  - Heavy deps to push into lazy chunks: `framer-motion` (Login only), `@hookform/resolvers` + `zod` (form screens), chart libs (Screen 9), the standards catalogs (Screen 11).
  - This is the source of the recurring Vite "chunks larger than 500 kB" warning — expected and acknowledged until this pass runs.

## Phase 4a mitigation planner

- **Extract shared `Pagination` component** — `TripletsPagination` is now reused by Screens 7 and 8. Rename / move to `src/components/Pagination.tsx` once a third caller appears.
- **Control-first bulk picker** — alternative UX deferred (pick a control, see/pick which triplets it applies to).
- **Per-triplet skip detail in bulk toast** — API returns reasons; UI does not currently surface them.
- **Large catalog pagination** — `/catalog/controls` / `/countermeasures` return all entries inline (70 / 50 in mock); add server-side pagination + search when real catalog grows past ~200.
- **Mitigation orphan handling** — if a recompute changes triplet IDs, stored mitigation selections for old IDs are silently orphaned. Sufficient for mock; real backend may want to re-map or surface.

## Phase 4b dashboard

- **Reduction-by-category bar chart** — per-asset-category reduction (how much risk each category shed). Deferred.
- **Risk distribution histogram** — score buckets across all triplets (original vs residual overlay). Deferred.
- **Before/after side-by-side heatmap** — the current Residual/Original toggle covers comparison; side-by-side variant deferred unless reviewers ask.

## Phase navigation (PhaseNav)

- **PhaseNav hover styling → CSS module** — `PhaseNav.tsx` currently swaps non-current item hover color via inline `onMouseEnter/onMouseLeave` style mutation. Cosmetic; migrate to CSS module in a future polish pass.
- **Phase completion validation gates** — optionally gate Continue on richer preconditions (e.g. Setup must have CIA set, Phase 2 must have ≥1 in-scope item).
- **Keyboard shortcuts** — e.g. Alt+←/→ to move between phases.

## Phase 4c export

- **Async download fallback** — if real backend generation exceeds ~10s, add job-submit + poll (or notify) with progress UI.
- **Real PDF/XLSX generation** — MSW returns valid *placeholder* documents (`officeBlobs.ts`); fully-rendered reports are a backend deliverable.
- **Project finalization integration** — `POST /projects/{id}/finalize` exists in the contract but Export neither enforces nor triggers it. Decide whether export finalizes/locks the project.
- **Section content fidelity contract** — when backend renders real PDF/XLSX, sections must match `ReportPreviewResponse` preview structure.
- **Mobile TOC drawer** — report sidebar is `visibleFrom="md"`; mobile TOC hidden (sections still scroll). Add collapsible drawer / hamburger / jump-to `Select` for small viewports.

## Build / deploy

- **Remove the `VITE_USE_MOCKS` MSW branch when real backend lands** — `src/main.tsx` currently starts MSW in dev OR when `VITE_USE_MOCKS=true` at build time. Drop that branch (and the Vercel env var) when production talks to the real API. See `docs/stack-decisions.md` "MSW gating".

## Frontend refactors

- **`projectStore.ts` decomposition** — ~263 lines (over the 260 hard cap) after the Phase 3 `scopeVersion` helpers landed. Mixes seed data, localStorage CRUD, legacy-CIA migration, Screen-3 detail derivation, and scope-version helpers. Extract in a dedicated pass; watch for a circular import if `getProjectDetail` moves.
- **Shared `ScreenState` component** — Hoist loading-skeleton + "Project not found" alert patterns into `src/components/ScreenState.tsx`. ~20 lines per screen savings. Threshold reached: Screens 2-4 inline, AssetsPage inline, ReviewStates local — consolidate next time this area is touched.

## Wireframe deviations

- **Forward "Continue" affordance on phase screens** — `PRIVACT_UI_Screens.pptx` shows no Continue button on phase screens (5-10); navigation implied via Project Overview hub + breadcrumb. We added an explicit page-level `PhaseFooter` per a UX directive ("clear navigation, no thinking required on each screen"). Wireframe deck refresh deferred to project-end artifact pass.

## Process learning

- **Phase 5b runtime regression** — the `CiaScore → RiskScore` rename caught the PascalCase type alias but missed the lowercase schema variable in `SetupPage.tsx`. Vite HMR mid-rename left a stale module in the running dev server while `tsc -b` + `eslint` + `npm run build` all stayed green. Surfaced as `ReferenceError: ciaScore is not defined`. The lesson became Gate 4.5 in `docs/working-agreement.md`: post-rename `tsc -b` **and** `npm run dev` cold-reload smoke before declaring the change done.
