# PRIVACT Frontend Development — Master Context

## What this is

I'm the solo frontend developer for the PRIVACT Risk Assessment Platform, part of the EU-funded AENAON cybersecurity project. PRIVACT has two halves: a "before deployment" risk assessment tool (what I'm building) and a separate "during operation" runtime detection platform (not my concern). Audience: CISOs, EU reviewers, security analysts. Internal B2B tool — function over flash.

In an earlier Claude conversation we analysed the project deeply and designed the full UI architecture. This prompt captures everything decided so we can pick up where we left off in this new chat.

## Files attached to this message

- `Risk_Analysis_Matrixes_D4_14__1_.xlsx` — the 34-sheet workbook with the engine mechanics (assets, threats, vulnerabilities, controls, countermeasures)
- `PRIVACT_Presentation_AENAON_WP3_pptx__1_.pdf` — 17-slide deck describing the 4 phases of the tool
- `Grant_Agreement_-_GAP-101249723.pdf` — EU grant agreement
- `PRIVACT_UI_Screens.pptx` — the English wireframe deck of all 11 screens with annotations (this is the design reference)
- `PRIVACT_UI_Screens_GR.pptx` — Greek internal-team version of the same wireframes (not needed for dev, just for context)

Plus reference documentation in `docs/`:
- `docs/backend-endpoints.md`
- `docs/risk-engine-logic.md`
- `docs/screens.md`
- `docs/working-agreement.md`
- `docs/stack-decisions.md`
- `docs/open-questions.md`

Please look at the wireframe deck (`PRIVACT_UI_Screens.pptx`) carefully — that's the design source of truth. And read the docs/ folder.

## How the risk engine works (4 phases)

**Phase 1 (Scope):** User defines assets in 7 categories (Database, Application/API, Container, Container Network, Hardware, OS, TCP/IP), rates each via 15-cell ROLFP matrix (Reputation/Operational/Legal/Financial/Personal × C/I/A, values 0–4).

**Phase 2 (Modeling):** Engine matches threats and vulnerabilities from pre-baked catalogs (55 threats, 96 vulnerabilities) against the user's assets using applicability matrices.

**Phase 3 (Generation):** ~5,000 (Asset, Threat, Vulnerability) triplets generated. Risk = Applicability × AssetImpact × ThreatProbability × VulnSeverity, computed per C/I/A, max taken. Bands: Low (0–8), Medium (9–29), High (30–80). Applicability is binary (1 or 0).

**Phase 4 (Output):** User picks controls (NIST CSF + CIS v8 Safeguards) and countermeasures (MITRE D3FEND) → engine recomputes residual risk live → user exports final requirements list.

## Decisions already made

**Backend contract:** REST + JSON only. No GraphQL, no WebSockets. ~25 endpoints across catalog (read-only static), projects CRUD, assets CRUD, engine output (triplets/summary/heatmap), mitigations (live recompute), exports (PDF/XLSX/JSON), auth via Keycloak. Backend will be mocked with MSW during frontend development.

**Frontend stack:**
- React + TypeScript + Vite
- Mantine (UI library — chosen over MUI/shadcn for data/form productivity)
- TanStack Query (server state)
- TanStack Table (for the ~5,000-row triplets table)
- React Flow (for the Phase 1b topology canvas, built later as v2)
- MSW (mock backend until real one is ready)
- React Router
- React Hook Form + Zod (forms)
- Recharts (bar charts), Plotly or D3 (heatmap) — added when needed
- Keycloak adapter (added last; auth stubbed during dev)
- Playwright/Vitest (optional, later)

**Workflow:** Local dev on localhost:5173 → push to private GitHub → Vercel auto-deploys preview URLs for sharing with the consortium → final production hosting (EU-compliant: institutional / OVH / AWS Frankfurt) decided later.

**Design tooling:** Wireframes in Excalidraw if needed; Mantine's default theme handles polish. PRIVACT colors: navy `#1E2A4A`, teal `#2DD4BF`, red `#EF4444`.

## The 11 screens (in build order)

Detailed wireframes are in `PRIVACT_UI_Screens.pptx`. Summary:

1. **App shell + routing + auth stub** — skeleton first
2. **Project List + Project Overview Hub** — navigational backbone
3. **Phase 1a — Setup Form** — project metadata + CIA priorities
4. **Phase 1b — Asset Inventory (table version)** — assets + 15-cell ROLFP grid in edit drawer
5. **Phase 2 — Threats/Vulnerabilities Review** — read-only filterable tables
6. **Phase 3 — Triplets Table** — TanStack Table with ~5,000 rows, server-side pagination
7. **Phase 4a — Mitigation Planner ★** — showcase feature, two-pane with live residual risk
8. **Phase 4b — Risk Dashboard** — KPI cards, heatmap, before/after bar chart
9. **Phase 4c — Export** — requirements list grouped by NIST CSF, PDF/XLSX/JSON download
10. **Phase 1b canvas version (React Flow topology)** — built second, after table version works
11. **Catalog Browser** — optional, low priority

Each screen ≈ 1 week. 7 critical screens for a working app.

## Working agreement (summary — full version in docs/working-agreement.md)

**Two modes:**
- **Mode 1 — "Tell me what to do":** For setup, structure, decisions. You give me step-by-step instructions. I execute, paste back errors or output.
- **Mode 2 — "Give me the code":** For full screen components (200-400 lines). You write the full code, I paste it, run it, tell you what I see, we iterate.

**Before coding any screen, you ask me:**
1. What does the user see when this screen loads?
2. What can the user do here?
3. What data does the screen need from the backend?
4. What happens when the user does each action?
5. What's out of scope for this version?

**When you give me code or instructions, always include:**
1. Where each file goes (exact path)
2. What to run after (npm install, restart, etc.)
3. What success looks like (so I can verify)
4. What to check if it breaks (common errors)

**Honest constraints we agreed on:**
- You can't run my code — I'm your eyes. I'll paste errors, screenshots, or "it works but X looks wrong."
- You forget across conversations — that's why I'm pasting this prompt now.
- First try won't always be right — plan on 2-3 iterations per non-trivial screen.
- One question at a time when possible — push back if you dump too many.

## Where we are right now

**Status:** Project not yet started. Nothing has been scaffolded. No code exists yet.

**The very next step** we agreed on: a setup session. You'll give me step-by-step instructions to:
1. Scaffold a Vite + React + TypeScript project
2. Install core deps (Mantine, TanStack Query, TanStack Table, MSW, React Router)
3. Set up the folder structure
4. Configure the Mantine theme with PRIVACT colors
5. Set up MSW with a stub `/me` endpoint
6. Create the app shell with routing and a placeholder Login screen
7. Push to a private GitHub repo
8. Connect to Vercel for preview deployments

Estimated: 1-2 hours of me copy-pasting commands. End result: running app at localhost:5173, deployed preview URL, fake login button → "Project List (todo)" placeholder.

**Then** we start Screen 1 properly with the question-driven workflow above.

## What I need from you in this first message

1. Confirm you've read the wireframe deck (`PRIVACT_UI_Screens.pptx`) and understand the 11 screens.
2. Confirm you've read the risk engine logic (Phase 1-4 above) and the docs/ folder.
3. Ask me anything that's unclear before we start.
4. Then begin the setup session: tell me the first batch of commands to run.

Let's go.
