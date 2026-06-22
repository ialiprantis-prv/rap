# PRIVACT Frontend Docs

Reference documentation for the PRIVACT Risk Assessment Platform frontend.

## How to use

**Starting a new Claude chat?**
Paste `MASTER_PROMPT.md` as your first message, attach the 5 source/wireframe files (xlsx, presentation PDF, grant agreement, English wireframe pptx, Greek wireframe pptx), and attach this whole `docs/` folder.

**Working day-to-day?**
Keep `docs/` committed to your repo. Reference these files when something is unclear.

## What's in here

| File | When to read it |
|---|---|
| `MASTER_PROMPT.md` | First message in a new Claude chat. The big picture in one place. |
| `backend-endpoints.md` | When wiring up MSW handlers or real API calls. ~25 endpoints. |
| `risk-engine-logic.md` | When implementing anything that touches risk math (Phases 1, 3, 4). |
| `screens.md` | Per-screen reference for what each screen does and which endpoints it uses. |
| `working-agreement.md` | The two modes (tell-me-what-to-do vs give-me-code), the 5 pre-screen questions, the deliverable checklist. |
| `stack-decisions.md` | Why each library was chosen (and what was rejected). |
| `open-questions.md` | Stuff to clarify with the backend team / consortium before certain screens. |

## Source files (NOT in this folder — keep them elsewhere and attach when needed)

- `Risk_Analysis_Matrixes_D4_14__1_.xlsx` — engine mechanics workbook
- `PRIVACT_Presentation_AENAON_WP3_pptx__1_.pdf` — original PRIVACT deck
- `Grant_Agreement_-_GAP-101249723.pdf` — EU grant agreement
- `PRIVACT_UI_Screens.pptx` — English wireframe deck (DESIGN SOURCE OF TRUTH)
- `PRIVACT_UI_Screens_GR.pptx` — Greek internal version
