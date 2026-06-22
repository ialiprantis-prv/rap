# How we work together

> **Last verified 2026-06-19 (v3 completion / C10).** The collaboration contract
> below stayed stable through v2 and v3 — Greek/English split, role split,
> pre-screen 5-question pattern, Gate 4.5, Phase navigation bidirectional
> principle. Standing rules R1/R2 added at v3 completion (also in CLAUDE.md).

## Standing rules

R1 - Context budget red flag. CLI: self-monitor /context + status line; at ~100K used or
~10% of the window remaining (whichever first), finish the current safe unit, then STOP
and red-flag the human ("context red flag: /clear or new session now") with a self-resuming
paste ready - never silently auto-compact mid-build. Chat (Claude.ai): no exact token meter
exists, so flag heuristically and early - after each heavy build/gate/audit cycle and when
the thread is long - recommending a handoff regen + fresh chat. Goal: switch before quality
degrades, never mid-task without a record.

R2 - Divergence disclosure. Anything chat-or-CLI proposes that conflicts with or does not
fully (100%) align with the core docs in docs/ (methodology kernel, locked decisions,
standards-decisions, working-agreement, v3-blueprint) must be flagged explicitly and up
front - naming the doc/decision and how it diverges - before proceeding. No silent
deviations. Extends METHODOLOGY PRESERVATION to all core docs.

## Roles

**User (web chat) — strategist.** Architecture, scope, approvals. Decides
trade-offs. Verifies runtime behavior in the browser (Claude Code can't
drive a browser).

**Claude Code (CLI) — builder.** Reads and writes files directly, runs
static checks (`npx tsc -b`, `npx eslint src`, `npm run build`),
arbitrary bash, MSW handlers, git operations. Surfaces findings,
proposes plans, reports outcomes faithfully.

We do **plan-then-approve-then-code** on every non-trivial change. Code
never starts before an explicit approval. Commits never happen without
an explicit "ok to commit". Push follows immediately after commit (per
default workflow — solo trunk, Vercel deploys HEAD).

> The old "two modes" model (you paste code I write, I paste output back)
> is superseded by direct file access. The 5-question pre-screen pattern
> and the iteration loop below survive from it.

## Before coding any screen, agent asks user — one at a time

1. What does the user see when this screen loads? (Empty? Loading?
   Pre-filled? All four states.)
2. What can the user do here? (Every button, every interaction.)
3. What data does the screen need from the backend? (Which endpoints.)
4. What happens when the user does each action? (Navigation, save
   behavior, optimistic vs wait, error handling.)
5. What's out of scope for this version?

**One question at a time. Wait for explicit confirmation before the
next.** No bundling. If the agent doesn't know, it says so and proposes a
default. If the user doesn't know, they say so and the agent proposes a
default.

Each answer locks into `docs/screen-specs.md` as the agreed spec.

## When the agent proposes code or a plan, it includes:

1. Exact file paths (relative to repo root).
2. Browser verification checklist (the user is the eyes for runtime).
3. What to check if it breaks (common errors + their meaning).
4. The static-check status (`tsc` / `eslint` / `build`) and when those
   were run against the final state.

## Iteration loop (per non-trivial change)

1. Investigation (read-only when the user asks, or when a runtime bug is
   reported — never guess; surface diffs + diagnoses first).
2. Plan + line-count / complexity estimates per file.
3. User approval (explicit, may carry options A/B/C with trade-offs).
4. Build, with stop-condition gates (typically 3–4 gates: foundation,
   substantive component(s), page wiring, validate). Stop on:
   unexpected error, line budget breach, or each pre-agreed gate
   checkpoint. **No autonomous "fix it" on unexpected errors.**
5. Final validate (Gate 4) + Gate 4.5 if applicable (see below).
6. Browser functional checklist by the user.
7. Commit + push only after explicit "ok to commit".

## Gate 4.5 — post-refactor smoke check (mandatory)

Triggered by **any rename or refactor that crosses module boundaries**:
type renames propagating into schemas, hook signature changes consumed in
multiple files, shared-component / shared-export extractions, etc.

1. **Fresh `npx tsc -b`** *post-edit* — not carried forward from an
   earlier gate. The source changes between gates can fix or break
   compilation; each cross-module refactor gets re-validated end-to-end.
2. **`npm run dev` cold-reload smoke check** — restart the dev server,
   hard-reload the browser tab (Ctrl+Shift+R or unregister SW + reload),
   confirm zero console errors on the landing page and any
   directly-affected route.

Both required before declaring the refactor done. Source-on-disk being
clean (proven by `grep` + `tsc -b`) does **not** guarantee the running
dev server has hot-reloaded cleanly. Vite HMR can fail mid-rename and
keep serving a stale module — the runtime error then points at line
numbers that no longer match the current source. Canonical example:
`docs/open-items.md` "Process learning — Phase 5b runtime regression".

## Phase navigation principle (bidirectional)

Project phases support **free navigation**, not just linear-forward. Two
affordances, present on every project-scoped page:

1. **`PhaseNav` strip** (`src/components/PhaseNav.tsx`) at the top of every
   page (immediately after the breadcrumb, before the page title). All 7
   phases (Setup, Assets & Links, Review, Triplets, Mitigations, Dashboard,
   Export — `src/lib/phaseRoutes.ts` is the single source of truth) are
   clickable for direct movement; the current phase is highlighted (navy).
   Clicking navigates to the clean phase URL (no preserved query params —
   fresh state per phase). The breadcrumb is trimmed to
   "Projects / {project}" since `PhaseNav` shows the current phase.
2. **`PhaseFooter`** retains the primary forward CTA — a right-aligned filled
   "Continue to Phase N+1" button (Screen 4's treatment) — AND, via the
   optional `previousPhase` prop, a left-aligned secondary outline
   "← Back to Phase N-1" button for iteration. Forward stays the visual
   emphasis; back is secondary.

Rationale: the linear "Save & Continue" framing was a misfit for an
**iterative** risk workflow — users must move freely between phases to see the
impact of changes (edit mitigations → check residual on the dashboard → go
back → adjust). Surfaced during the Screen 9 browser sweep.

- Continue stays disabled until the phase's minimum precondition is met (e.g.
  Phase 1b: ≥1 asset), with a tooltip stating what's required.
- On Continue click, flush/discard any pending in-screen edit (consistent with
  that screen's other nav paths) before navigating.
- **First phase (Setup)** has no Back; **last phase (4c — Export)** has no
  Continue (terminal). `PhaseFooter` without `previousPhase` renders exactly as
  before (flex-end, Continue only) — backward compatible.

## Honest constraints

- The agent can run static checks (`tsc`, `eslint`, `build`) and any
  bash. It **cannot** drive a browser — the user is the eyes for visual
  and runtime behavior.
- **Static green ≠ page boots.** See Gate 4.5 above.
- The agent forgets across conversations. Snippet docs (`docs/`) carry
  context. `CLAUDE.md` is the up-to-date orientation entry point.
- First try won't always be right. Plan on 2-3 iterations per non-trivial
  screen.
- Report outcomes faithfully — failures plainly stated; line counts and
  exit codes verbatim where it matters.

## Tone & style

- I'm not a beginner but I'm solo and learning the stack. Explain
  rationale when it matters, skip it when obvious.
- No emojis. Clean prose. Code blocks for code. Lists when they help.
- Greek is fine for high-level discussion but technical content / code
  in English.
