# Stack Decisions (and why)

## Core stack (v1 baseline — unchanged in v2)

- **React 19 + TypeScript 5 + Vite** — standard, fast HMR. `verbatimModuleSyntax` (use `import type`), `erasableSyntaxOnly` (unions, no enums), `noUnusedLocals/Parameters`.
- **Mantine v9** — chosen over MUI (heavier) and shadcn (too low-level for productivity); ships ~80% of what we need: tables, forms, modals, drawers, notifications, theming.
- **TanStack Query** — server state, caching, refetching, optimistic updates.
- **TanStack Table** — ONLY for the ~5,000-row triplets table; Mantine Table everywhere else.
- **React Router 7** — routing.
- **MSW (Mock Service Worker)** — mock backend during dev; intercepts fetch calls, returns stubbed JSON.
- **React Hook Form + Zod** — Controller-wrapped Mantine inputs (locked pattern).
- **Vercel** — hosting (preview + production).

## v2 additions

- **No new framework-level dependencies.** Intentional — keep dependency footprint minimal. Standards adoption is implemented with hand-rolled types + adapters.
- **Hand-rolled CycloneDX 1.6 type subset** — `src/types/cyclonedx.ts`. Component vocabulary (13 types: 12 standard + `cryptographic-asset` PRIVACT extension), serial number, bom-ref scheme, properties.
- **Hand-rolled OSCAL 1.1.2 type subset** — `src/types/oscal.ts`. Assessment Results shape (metadata, parties, observations, risks, findings, characterizations).
- **Hand-rolled CVSS Environmental calculator** — `src/lib/cvssEnvironmental.ts`. CVSS 3.1-style approximation; faithful Modified Impact Sub-Score (MISS), scope-aware Modified Impact, Modified Exploitability with scope-aware PR weights, roundup to 1 decimal capped at 10.0. For CVSS 4.0 vectors applies the 3.1 formula against AV/AC/PR/UI/C/I/A letters; full 4.0 needs MacroVector tables. Labeled "PRIVACT environmental approximation".
- **Hand-rolled standards catalogs** — `src/lib/cweCatalog.ts`, `enisaCatalog.ts`, `enisaActorCatalog.ts`, `nistCatalog.ts`, `cisCatalog.ts`, `d3fendCatalog.ts`. Static, version-controlled reference data with hierarchy navigation helpers.
- **Hand-rolled CycloneDX importer** — `src/lib/cyclonedxImporter.ts`. Lenient 1.4 / 1.5 / 1.6 support; resolves CDX components into internal `Asset`/`Service`/`Link` entities; defaults missing PRIVACT fields (ROLFP → zeros).

## Standards adoption decisions (full detail in `docs/standards-decisions.md`)

- **Asset model:** CycloneDX 1.6 native (commit 03).
- **Vulnerability:** CWE refs + CVSS 4.0 Base + 3.1-style Environmental override (commits 01, 13).
- **Threat:** ENISA Threat Taxonomy 2022 + STIX 2.1 shape preparation (commits 08, 09).
- **Action:** NIST CSF v2.0 + CIS Controls v8 + MITRE D3FEND refs (commit 10).
- **Export formats:** CycloneDX 1.6 (commit 02), OSCAL 1.1.2 Assessment Results (commit 12).
- **Import formats:** CycloneDX 1.4 / 1.5 / 1.6 (commit 06).
- **PRIVACT methodology extensions** encoded as `x-privact:*` properties in CycloneDX exports + `props` entries in OSCAL outputs.

## Optional / later

- **react-i18next** — i18n if/when the consortium asks (Option G).
- **Playwright** — E2E testing.
- **Vitest** — unit testing.
- **OpenAPI codegen** — when the real backend exposes a spec.
- **Sentry** — error tracking before production.
- **Keycloak adapter** (`@react-keycloak/web` or similar) — auth stubbed during dev.

## Theme: PRIVACT colors

- Navy primary: `#1E2A4A`.
- Navy dark: `#0F1B36`.
- Teal accent: `#2DD4BF`.
- Red accent: `#EF4444`.
- Amber: `#F59E0B`.
- Green: `#10B981`.

## MSW gating (mock backend in deployed builds)

- The frontend has no real backend yet; MSW provides the entire `/api/v1` surface. `src/main.tsx` starts the worker when `import.meta.env.DEV` **OR** `import.meta.env.VITE_USE_MOCKS === 'true'`.
- **`VITE_USE_MOCKS` is inlined by Vite at *build* time** (not a runtime variable). Vercel must have `VITE_USE_MOCKS=true` set in the project env (Production + Preview + Development) so it's present when Vercel runs `npm run build`. Without it, the MSW chunk is dead-code-eliminated and every `/api/*` call hits Vercel's SPA rewrite → returns `index.html` → the auth check loops forever (blank navy screen). Resolved in commit `1319b8c`.
- MSW loads as a lazy chunk (`dynamic import('./mocks/browser')`), so the entry bundle is unaffected; the ~300 kB handlers + seeds chunk is emitted only when the gate can be true at build time. `public/mockServiceWorker.js` ships to `dist/` and is served at the site root (required for `worker.start()`).
- **Remove the `VITE_USE_MOCKS` branch once a real backend is wired** (see `docs/open-items.md` "Build / deploy").

## Workflow

- Local dev: `npm run dev` on `localhost:5173`.
- Version control: private GitHub repo. Tags `v1.0` (on `main`) + `v2.0` (on `v2-standards-aligned`); v2 work continues on the branch pending promotion decision.
- Preview deployments: Vercel auto-deploys every push (preview URLs to share with consortium). Requires `VITE_USE_MOCKS=true` in the Vercel env (see MSW gating above).
- Production hosting: TBD by consortium (likely institutional / OVH / AWS Frankfurt — must be EU-compliant).

## Things we DECIDED AGAINST

- **GraphQL** — overkill for 45 REST endpoints.
- **WebSockets** — no real-time requirements.
- **Redux / Zustand** — TanStack Query covers server state; React state covers UI state.
- **Figma** — overkill for an internal data tool; Excalidraw if any wireframing needed.
- **Storybook** — solo dev, not worth the overhead yet.
- **Monorepo** — single app, no shared packages.
- **Path aliases** — relative imports throughout. Decided early; not worth a migration now.
