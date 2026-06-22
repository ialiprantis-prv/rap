# PRIVACT v3 — Session Handoff / State Snapshot

Checkpoint after **v3 COMPLETE (C10)**. Use this to resume on a fresh Claude chat and a fresh
Claude Code CLI with zero knowledge loss. The repo docs are canonical; this file consolidates
them plus the working model, the **standing rules**, the methodology kernel, and the locked
decisions.

---

## 0. Exact current state (verified)

- Branch **`v3`**. **`origin/v3` = `79e549b` (C10b)** — C1a→C10 committed AND pushed. Working
  tree clean, in sync with origin.
- Repo: `/home/ialiprantis/projects/risk-frontend` (WSL2).
- **47 backend endpoints** (all MSW-mocked). v1 35 → v2 45 → v3 47 (after the v3 series and
  C10's −5 v2-triplet-pipeline retirement).
- v3 is **functionally complete**: live risk engine, Scope, live Triplets, vuln-instance
  Mitigations (D3FEND), live Dashboard, Export (CycloneDX + OSCAL). The v2 triplet pipeline is
  fully retired (C10).
- Canonical docs: `CLAUDE.md`, `docs/v3-blueprint.md`, `docs/open-questions.md`,
  `docs/backend-endpoints.md`, `docs/risk-engine-logic.md`, `docs/working-agreement.md`,
  `docs/standards-decisions.md`, `docs/screen-specs.md`.

### Commit ladder (origin/v3)
```
d7da23d  C7-2   live risk UI + Review->Scope->Triplets + v2 retire (Triplets screen only)
3c51f47  C8     vuln-instance mitigations + D3FEND snapshot + severity-recompute residual
a570011  C8-fix remediate-toggle crash fix (state-derived toggle + first vitest tests)
1157eed  C9a    live gating + Dashboard from shared residual model (parity test)
db5b1c1  C9b    Export -> v3 live + native standards mapping + provenance stamp
39ffb55  C9c    cleanup + /catalog sub-tab fix; retire dead v2 export/dashboard/mitigation
a0043bd  C10a   applicability-override store-only (drop inline v2 triplet regen)
79e549b  C10b   retire orphaned v2 triplet pipeline (delete 14 modules + 5 endpoints) [HEAD]
```

## 1. Working model (two-tool) + STANDING RULES

- **Claude in chat = strategist/auditor.** Pre-screens each commit (locks decisions one fork
  at a time), writes the English build paste, audits the returned Gate 4.5 report, approves.
- **Claude Code CLI = builder.** Builds, stops at Gate 4.5, reports; commits only on the
  relayed approval; every commit is followed by a push. CLI sessions are stateless — resume
  from `CLAUDE.md` + `docs/v3-blueprint.md` + `git log`.
- The human relays. Approvals reach the CLI only through what the human pastes verbatim.
- **Language:** human writes Greek; code/docs/CLI English. No emojis.

**Gate 4.5** = `tsc` 0 / `eslint` 0 / `build` 0 + all-route dev-boot smoke + endpoint
inventory delta + bundle delta + file caps (220 soft / 260 hard; generated seeds exempt) +
flagged deviations. **Human browser smoke is a HARD pre-commit gate** — commit approval is not
relayed until the human confirms the smoke clean (C8 lesson). **Material-consumer STOP** before
removing live-consumed code (reverse-import / reachability-from-routes for deletions). Every
build paste ends with "commit AND push".

### STANDING RULES — apply on EVERY fresh chat and EVERY fresh CLI session (not just at handoff)

**R1 — Context budget red flag.**
- *CLI (Claude Code):* self-monitor the budget (`/context`, status line). At **~100K tokens
  used, or when ~10% of the window remains (whichever first)**, finish the current safe unit,
  then STOP and red-flag the human — "context red flag: /clear or new session now" — with a
  self-resuming paste ready. Never silently auto-compact mid-build.
- *Chat (Claude.ai strategist):* the model has **no exact token meter**, so it flags
  **heuristically and early** — after each heavy cycle (large build paste + full gate report +
  audit) and whenever the thread is visibly long or the human reports sluggishness, recommend
  regenerating this handoff and starting a fresh chat. Err conservative.
- Goal both ways: the human switches *before* quality degrades, never mid-task without a record.

**R2 — Divergence disclosure.** Whenever Claude (chat or CLI) proposes anything that conflicts
with, or does not fully (100%) align with, the **core docs in `docs/`** (the methodology
kernel, the locked decisions, `standards-decisions.md`, `working-agreement.md`,
`v3-blueprint.md`), it must flag the divergence **explicitly and up front** — naming the exact
doc/decision and how it diverges — before proceeding. No silent deviations. (Extends the
existing METHODOLOGY PRESERVATION rule to all core docs.)

## 2. Methodology kernel (INVARIANT — never change)

Per CIA dimension d in {C,I,A}:
```
Risk_d = Impact_d × ThreatApplicability_d × Probability × Severity
  Impact_d              = asset ROLFP column-max for d (max of R,O,L,F,P)        0-4
  ThreatApplicability_d = the THREAT's CIA flag for d                            0/1
  Probability           = effective (override ?? heuristic), per (threat,type,zone) 0-4
  Severity              = effective (override ?? round(cvss/2)), per vuln         0-5
Max Risk = max(Risk_C, Risk_I, Risk_A)   0-80
Bands: Low 0-8 / Medium 9-29 / High 30-80
```
- ROLFP = 5 dims (Reputation/Operational/Legal/Financial/Personal) × 3 CIA per asset.
- A triplet = (asset, threat, vulnerability). Severity is **scalar** (from the vuln), not
  per-CIA. Per-CIA gating comes ONLY from the threat's CIA flag.
- **FIDELITY CORRECTION (locked):** applicability is **threat-CIA-only**. v2's `threat ∩ vuln
  CIA` deviation is removed. Numbers differ from v2 by design.
- Mitigation acts on the **Severity** factor only; the rest of the kernel is untouched.
- All suggested/default values are pre-fills; the analyst owns every number.
- Methodology phases (preserved permanently): Setup -> Assets -> Review -> Triplets ->
  Mitigations -> Dashboard -> Export. *v3 UI adds a **Scope** step in the Review->Triplets flow
  (pre-triplet scoping, C6/C7-2) — a UI step, not a methodology-phase rename.*

## 3. Build sequence — status (v3 COMPLETE)

Foundation C1a→C7 (asset taxonomy, MAGERIT/ENISA/ATT&CK threat sources, CPE+CVE matching,
zones/probability, scoping, v3.1 risk engine + live triplets + live risk UI) — see
`docs/v3-blueprint.md`. The v3 feature commits:

- **C8 — Mitigations (vuln-instance, live).** `MitigationRecord` per (asset,CVE): optional
  `remediate` + `countermeasures[]`. Remediate -> severity 0 (dominates). Mitigate ->
  **strongest-only** `max(0, sev - max|eff_i|)` (never additive). Effectiveness defaults:
  Isolate -3, Harden -2, Deceive/Detect -1, Evict/Restore/Model 0; override 0..-5. **D3FEND
  snapshot-only** (1.4.0 / 2026-03-31: 271 techniques + a curated **PARTIAL** 10-CWE overlay,
  labelled "partial"; live API stubbed off). CWE ids from `VulnRecord.cweIds`. Coverage =
  % triplets residual<original; project reduction% = score-mass.
- **C8-fix** — remediate-toggle crash (state-derived toggle); first vitest tests.
- **C9a** — live gating (`derivePhaseStatuses` + `useLiveTriplets`); Dashboard reads the same
  shared live residual model as Mitigations (identical by construction; parity test).
- **C9b** — Export -> v3 live; **native-construct-first** standards mapping with a faithfulness
  guardrail (D3FEND-mitigate is NEVER serialized as CycloneDX `resolved` or OSCAL
  completed-remediation; it is `exploitable`+workaround / `mitigating-factors`+`remediating`);
  full bounded provenance stamp (methodology v3.1, build SHA, scope descriptor, standards
  versions honestly labelled, cve asOf).
- **C9c** — cleanup + `/catalog` Actions sub-tab fix (atomic URLSearchParams write; the
  react-router 7.x functional-updater closes over stale render params — pre-existing bug);
  NIST/CIS demoted to **reference-only** in `/catalog` (banner; out of scoring).
- **C10a/C10b** — v2 triplet pipeline fully retired: override handler is **store-only** (no
  inline v2 regen); 14 dead modules + 5 endpoints deleted (52->47). v3 stores
  (`mitigationV3Store`, `residualRiskV3.ts`) and the live `cvssEnvironmental.ts` calculator
  untouched.

## 4. Locked decisions to carry (C7→C10)

- **C8 mitigations** as in section 3 (vuln-instance; remediate->0; mitigate->strongest-only).
- **D3FEND snapshot-only**; overlay is curated-PARTIAL by an objective direct-link rule
  (broader SPARQL closure excluded as all-Harden noise); manual full-catalog picker for
  unmapped CWEs.
- **C9a Dashboard = live read** (no snapshot/staleness); Export carries the download-time
  generation stamp. Gating greens a phase once >=1 in-scope resolved triplet is derivable.
- **C9b mapping = native-construct-first + faithfulness guardrail** (test-enforced).
- **C9b provenance = full but bounded** (honest about unpinned CWE / mixed per-CVE CVSS / as-of
  cve data; no fabricated versions).
- **C9c NIST/CIS = reference-only** (browsable, not wired into scoring; D3FEND->NIST/CIS
  crosswalk deferred — needs a real published mapping).
- **Coverage metric** = residual<original (confirmed).
- **Architecture:** client-only source adapters; backend is a future swap-in behind the same
  interface; **no third-party CORS proxies ever**; tool stays domain-generic (demo data is
  clearly demo). Store policy: extend the read-boundary normalizer, never bump the store key.

## 5. KNOWN FINDINGS + deferred items — raw material for the V4 discussion (NOT a plan)

**There is no committed V4 scope. The next chat opens the V4 scoping discussion from scratch;
everything below is a candidate only.**

- **Applicability-override divergence (flagged per R2).** A `/review` per-asset applicability
  override surfaces in the **OSCAL export metadata only** (`x-privact:applicability-overrides`)
  — it does NOT move v3 Triplets/Dashboard risk, which read the separate **scope-pruning
  model** (`useTripletScope`). The `PerAssetApplicabilityTab` may be partly vestigial vs the v3
  Scope screen. Candidate V4 reconciliation. (That tab is also the 320-line documented cap
  deviation — refactor candidate.)
- **NVD client-side CORS limit.** NVD is not browser-CORS-friendly / rate-limited / key-gated;
  the client-only architecture attempts-and-degrades and falls back to cached/seeded CPEs. A
  backend NVD proxy is the fix — likely a core V4 motivation. For demos, use seeded data.
- **Backend swap-in** behind the existing client source-adapter interface (the natural V4
  centerpiece; tool stays domain-generic).
- New sources: EUVD (backend-proxied — CORS-blocked client-side), CISA CSAF->sector index,
  NIST SP 800-30 App.E, BSI elementary threats.
- Probability refinement (ENISA-prevalence, EPSS); full OSCAL adoption; D3FEND->NIST/CIS
  crosswalk; CWE-version pinning; D3FEND snapshot lazy-load / code-split.
- The backend-contract reconciliation items in `docs/open-questions.md` remain valid for the
  backend phase.
- Pre-eval data note: seed variety/High triplets + at least one demo CVE whose CWE is in the
  10-CWE overlay (so the D3FEND suggestion chain is demonstrable, not just the manual picker).

---

## A. Fresh CLI — paste this to a new Claude Code session

```
RESUME — PRIVACT v3, fresh session. You are the BUILDER (Claude Code) on branch `v3`. A
strategist session (relayed by the human) drives specs; you build, gate, report; you do NOT
commit until told; every commit is followed by a push. Read first: CLAUDE.md (working
agreement, Gate 4.5, STANDING RULES), docs/v3-blueprint.md, docs/open-questions.md.

VERIFY: `git log --oneline -3` HEAD = 79e549b (C10b). `git status` clean; `git branch -vv`
shows v3 tracking origin/v3 in sync.

STATE: v3 is COMPLETE (C1a->C10 done and pushed; 47 endpoints; v2 triplet pipeline retired).
No committed V4 scope yet. Do NOT start building until the strategist's build paste arrives.

STANDING RULES (always apply):
- Context: self-monitor /context; at ~100K used or ~10% window remaining, finish the current
  safe unit, then STOP and red-flag the human to /clear (self-resuming paste ready). Never
  silently auto-compact mid-build.
- Divergence: if anything you propose conflicts with or doesn't fully align with the core docs
  in docs/, flag it explicitly (name the doc/decision + how) before proceeding.

PROTOCOL: Gate 4.5 = tsc/eslint/build 0 + all-route dev-boot smoke + endpoint delta + bundle
delta + file caps (220/260) + flagged deviations. Material-consumer STOP before removing live
code. After a gate, STOP and report; on approval commit AND push, report new origin/v3 HEAD.
```

## B. Fresh Claude chat — paste this to a new conversation (same project)

```
You are resuming as STRATEGIST/AUDITOR for the PRIVACT v3 Risk Assessment Platform
(React/TS/Vite/Mantine). Two-tool model: you spec + audit in chat; Claude Code CLI builds in
WSL2; I relay. I write Greek; code/docs/CLI English; no emojis.

Read the project files first — canonical: docs/v3-blueprint.md, docs/open-questions.md,
CLAUDE.md, docs/risk-engine-logic.md, docs/standards-decisions.md. Read the attached
PRIVACT-SESSION-HANDOFF.md for the working model, STANDING RULES, methodology kernel, locked
decisions, and exact state.

State: branch v3, origin/v3 = 79e549b (C10b), C1a->C10 done and pushed, working tree clean,
47 endpoints. v3 is COMPLETE; the v2 triplet pipeline is retired.
Methodology invariant: Risk_d = Impact_d × ThreatApplicability_d(threat-CIA-only) ×
Probability × Severity; Max = max(C,I,A) 0-80; bands 8/29/80.

STANDING RULES (apply every session):
- Context red flag: you have no exact token meter, so flag early/heuristically — after each
  heavy build/gate/audit cycle and whenever the thread is long, recommend regenerating the
  handoff and starting a fresh chat, so I switch before quality degrades.
- Divergence disclosure: flag explicitly anything you propose that conflicts with or doesn't
  fully align with the core docs in docs/ (name the doc/decision + how), before proceeding.

Next task: there is NO committed V4 scope. Open the V4 scoping discussion from scratch — help
me define what V4 is, drawing on the deferred items + flagged findings in
PRIVACT-SESSION-HANDOFF.md section 5 (notably the backend swap-in / NVD proxy and the
applicability-override vs scope-pruning reconciliation). Do NOT presume scope; scope it with me.

Work the established loop: pre-screen (lock decisions one fork at a time) -> English build
paste ending "commit AND push" -> audit the Gate 4.5 report -> approve. Start by confirming
you've read the docs and the standing rules, then ask me what V4 should be.
```
