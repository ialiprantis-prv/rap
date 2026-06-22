# Next Phase Plan (post-v2.0)

> **SUPERSEDED (2026-06-19, v3 completion / C10).** The post-v2.0 polish (D) →
> backend-integration (E) sequence below was the plan *after the v2.0 tag*; it was
> overtaken by the v3 series (CVE-per-CPE live engine, C1–C10). **v3 is now
> complete** (`origin/v3 = 79e549b`, 47 endpoints, v2 triplet pipeline retired).
> **V4 is to be scoped from scratch in a new conversation** — there is no committed
> V4 plan. Candidate topics are raw material in `docs/PRIVACT-SESSION-HANDOFF.md`
> §5 (KNOWN FINDINGS + deferred items), NOT a plan. The content below is retained
> for historical reference and for the backend-integration items that still apply.

The explicit sequence for what comes after the `v2.0` tag (2026-05-28). Five steps, with current status flags.

## Sequence

### 1. Polish (D) — CURRENT

**Status:** User running general sweep of v2 preview deployment as of the v2.0 tag date (2026-05-28).

**Workflow when sweep findings arrive in chat:**

1. User sends findings list — accept any format (screenshots, bullet points, descriptive narrative, even casual mentions).
2. Strategist organizes findings by category:
   - Mobile UX issues (drawer/modal transition gaps, touch targets, narrow viewport breakage).
   - Empty / edge state coverage (no triplets, no assets, no mitigations, fresh project).
   - Error handling / loading states (network failures, validation feedback, race conditions).
   - Cross-feature interactions (e.g., environmental override + applicability override on the same triplet).
   - Accessibility / keyboard navigation.
   - Visual polish (alignment, spacing, color consistency, hover states).
3. Strategist proposes commit grouping:
   - **Atomic per concern** when issues are independent (one bug = one commit).
   - **Batched** when 2-3 issues share a root cause or component scope (e.g., all empty states across phases in one commit).
4. For each commit: standard pre-screen pattern → build paste to CLI → Gate 4.5 → sweep approval → commit + push.
5. Repeat until the findings list is exhausted.
6. If new findings arrive mid-stream (review feedback, additional sweep): queue them, finish the current commit, address in the next batch.

**What the user should expect during this phase:**

- Each polish commit is small and visible (single issue or tight cluster).
- Atomic commits = clean git history = easy revert if needed.
- No methodology touches, no architecture changes.
- Light bundle impact per commit (polish ≠ features).

**What the user should NOT expect during this phase:**

- New features (those wait for E and F).
- Methodology changes (off-limits permanently — see `CLAUDE.md` "METHODOLOGY PRESERVATION").
- Architecture refactors (none planned until backend integration motivates them).

**Phase ends when:**

- Sweep findings list exhausted, AND
- Stakeholder review window concludes (step 3), AND
- User signals readiness to move to step 4 (backend integration prep).

**Estimated duration:** 1-2 weeks depending on findings volume and review velocity.

**Tracking:** issues land in `docs/open-items.md` "Polish needs" as the user reports them.

### 2. Docs refresh — IN PROGRESS (this commit)

Sync all `docs/` to v2.0 reality. Foundation for the next phases — a new collaborator (human or AI instance) should be able to pick up the project state by reading the docs.

**Output:** `CLAUDE.md` + 14 `docs/*` files refreshed or created, ending with `git tag v2.0` referenced as the canonical baseline.

### 3. Stakeholder review window (B) — PARALLEL

User shares the v2 preview URL with reviewers (EU AENAON consortium, CISOs, healthcare audience). Feedback gathered into `docs/open-items.md` "Polish needs". Polish commits incorporate review feedback. **Gates the next phase** — E does not start until review settles.

### 4. Backend integration prep (E) — NEXT BIG THING

Two sub-phases:

- **E1: Frontend abstraction cleanup.** Verify clean MSW vs real boundary. Error handling for real network conditions. Env switch (`VITE_USE_MOCKS=false`) verification. Retry / loading polish.
- **E2: API contract document.** Self-contained specification the backend developer implements against. Includes request/response schemas, error response standardization, auth model, pagination/filtering conventions, performance expectations. Builds on `docs/backend-endpoints.md` + `docs/backend-integration-playbook.md`.

**E2 is the deliverable** the user hands to the backend developer. After E2, backend implementation proceeds in parallel with E3.

- **E3 (optional, when backend is ready):** integration testing with the real backend. Switch env vars. Verify endpoints. Debug.

### 5. Custom creation UIs (F partial × 3) — AFTER E

Three features deferred from v2:

- Custom **vulnerability** creation UI with CWE picker (deferred from commit 07).
- Custom **threat** creation UI with ENISA picker (deferred from commit 08).
- Custom **action** creation UI with framework picker (deferred from commit 10).

These depend on the backend's ability to persist custom entities, hence sequenced after E.

## Deferred (not in immediate plan, may revisit)

- **Option A: Merge v2 → main.** Production promotion to v2.0. Pending stakeholder review settling.
- **Option C: EU deliverable documentation** — formal write-up for the consortium.
- **Other F options:** multi-project comparison, project templates, risk trends, multi-user collaboration.
- **Option G: i18n** — likely Greek + English at minimum, coordinated with consortium.
- **Option H: CVSS Safety parameter** conditional UI (safety-critical project toggle) — listed in `docs/v2-migration-progress.md` "Planned".
- **TripletDetailModal Suggested Actions with framework chips** — follow-up from commit 10.
- **MitigationsBulkPickerModal framework filter** — follow-up from commit 10.

## Re-entry checklist

When starting a new chat session post-v2.0:

1. Read `CLAUDE.md` fully.
2. Read this file (`docs/next-phase-plan.md`).
3. Skim `docs/open-items.md` "Polish needs" for the current sweep state.
4. Skim `docs/open-questions.md` for anything blocking.
5. Check `git log --oneline -5` for any post-v2.0 commits on `v2-standards-aligned`.
6. Open the preview URL to see the deployed state.
7. Ask the user which step (1-5) we're working on.
