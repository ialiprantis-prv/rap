# Working Agreement

---

## Two-tool model

Chat (strategist/auditor): plans, specs, audits, asks questions, and approves.
Claude Code CLI (builder): reads the plan relayed by the human, writes code, runs gates.
Human: relays chat output to the CLI, relays CLI output back to chat, approves commits.

This split is fixed. Chat does not commit; CLI does not decide scope.

---

## PROPOSE-DON'T-APPLY

No repository edit, commit, or push happens without explicit per-action approval from the
human. The CLI proposes; the human approves each action before it runs. This applies to
every commit, push, and destructive operation.

---

## Language

English for code, technical decisions, and documentation. Greek is acceptable for
high-level strategy discussion in chat. No emojis anywhere.

---

## Pre-screen spec-lock pattern

Before the CLI receives any build paste, the strategist locks these items in chat with
the human, one question at a time, waiting for explicit confirmation between each:

1. Goal (one sentence).
2. Decisions to lock (up to 5 explicit items).
3. Scope boundaries (in / out).
4. Files affected (estimated list).
5. Sweep checklist (what to verify after the build).

A build paste is not sent until all items are confirmed.

---

## Build paste format

Headed by: `v4 commit #N on branch:`

Sections:
- Goal
- Decisions locked
- Files (NEW / MOD / RENAME / DELETE)
- Implementation details
- Sweep checklist
- Gates expected
- Commit message draft
- "Stop at Gate 4.5. Do NOT commit until the human approves the sweep."

---

## Gate 4.5

Mandatory before any commit. Run in order; stop and report if any step fails.

1. `npx tsc -b` in each workspace -> exit 0.
2. `npx eslint src` in frontend and backend -> exit 0.
3. `npm run build` for frontend and backend -> exit 0.
4. Backend API smoke: start the server, hit each API endpoint with a sample request,
   confirm expected responses.
5. Frontend dev-boot smoke: start Vite dev server, load every top-level route (Setup,
   Assets, Review, Triplets, Mitigations, Dependencies and Cascading, Dashboard, Export,
   Catalog), confirm zero console errors and no blank routes.
6. Docker build: `docker build` completes without error.
7. Report bundle delta (raw and gzipped).
8. Report file sizes. Soft cap 220 lines; hard cap 260 lines. Flag any file exceeding
   the soft cap; document deviation with rationale if the hard cap is exceeded.
9. Report any deviations from the locked spec.

A green build (step 3) does not satisfy Gate 4.5. The dev-boot smoke (step 5) is required
because a build can succeed while a route throws a runtime render error.

---

## Standing rules

### R1 — Context budget

Self-monitor context usage. At approximately 100K tokens used or when approximately 10%
of the context window remains (whichever comes first), finish the current safe unit of
work, then stop and flag to the human with a self-resuming resume paste. Do not silently
auto-compact mid-build. In chat (no exact token meter), flag heuristically and early:
after each heavy build or gate cycle and when the thread is long.

### R2 — Divergence disclosure

Any proposal that conflicts with or does not fully align with the core docs (this working
agreement, methodology-kernel.md, build-ladder.md, architecture.md, integrations.md) must
be flagged explicitly and up front, naming the document and describing the divergence,
before proceeding. No silent deviations. Methodology preservation is non-negotiable:
if a request appears to require changing the formula, scales, bands, ROLFP, or phase names,
push back before doing anything.

---

## Commits and branching

Atomic commits: each commit does one coherent thing. Commit messages describe what changed
and why. Push to remote after each commit (or pair of commits for two-commit refactors).

For major refactors spanning multiple concerns, use a two-commit split: one commit for
the structural change, one for the semantic change, with a clear description of why.

---

## Methodology preservation

The PRIVACT methodology kernel (formula, scales, bands, ROLFP, residual model, phases) is
the invariant core of the tool. It does not change in response to framework adoption,
integration requirements, or UI requests. Any request that appears to touch the kernel
triggers a mandatory push-back and confirmation cycle before any code is written.
