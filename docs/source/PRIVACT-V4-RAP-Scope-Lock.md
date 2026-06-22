# PRIVACT V4 — Risk Assessment Platform (RAP): Architecture & Scope Lock

**Status:** all decisions locked via the spec-lock grill (this session). Build NOT started.
**Tool:** T3.4-PRV-RAP · AENAON (GA 101249723) · TRA service · TRL 7.
**Basis:** an **evolve** of the v3 React/TS `risk-frontend`; `RAP_Specification_for_Build.md` (the V4 spec); AENAON Integration Matrix + WP3 D3.1 workbook; the CLX↔PRV integration email.
**Operating mode:** PROPOSE-DON'T-APPLY — no repo edit / commit / push without explicit per-action approval; CLI builds, chat strategist audits, human relays + approves.

> Source files for this V4 set live alongside this doc in `docs/v4/`: `RAP_Specification_for_Build.md`, `AENAON_Integration_Matrix.csv`, `AENAON_WP3_D31_Workbook_Instructions.csv`. The v3 methodology rationale lives in the `risk-frontend/docs/` of the existing repo.

---

## 0. What V4 is
Turn the v3 client-side risk tool into the AENAON RAP: **same PRIVACT methodology**, evolved (not rebuilt) into a containerised product with a small server backend, a new **cascading-risk** engine, and partner integrations. The methodology kernel is unchanged from v3.

## 1. Methodology kernel — INVARIANT (carried from v3)
Per CIA dimension d ∈ {C,I,A}:

`Risk_d = Impact_d × ThreatApplicability_d × Probability × Severity`

- Impact_d = max of the asset's 5 ROLFP values in d (0–4); ROLFP = 5×3 matrix.
- ThreatApplicability_d = the threat's CIA flag for d (0/1) — **threat-CIA-only** (v3 fidelity correction kept).
- Probability = effective (override ?? suggestion), 0–4, per **(threat × asset type × zone)**.
- Severity = effective (override ?? round(CVSS/2)), 0–5.
- Max Risk = max(Risk_C, Risk_I, Risk_A), 0–80. **Bands: Low 0–8 / Medium 9–29 / High 30–80.**
- Mitigation acts on **Severity only**: residual = re-run the formula with reduced severity; **strongest single** countermeasure (D3FEND tactic deltas: Isolate −3, Harden −2, Deceive/Detect −1, Evict/Restore/Model 0; override [−5,0]); no stacking.
- All defaults are pre-fills; the analyst owns every number.
- Phases (permanent): Setup → Assets → Review → Triplets → Mitigations → Dashboard → Export. Scope = UI step in Review→Triplets; Catalog = reference; **new**: Dependencies & Cascading screen.

## 2. NEW in V4 — Cascading (propagated) risk  [GA Objective 5; RAP-owned, D-1]
Additive layer on top of the kernel; does **not** change the triplet formula.

- Dependency graph: nodes = assets; edges = containment/host links (from the BOM + asset `parent_ref`) **plus** analyst-added explicit edges (data-flow, authentication, network).  [1.4 C]
- Each edge carries τ ∈ [0,1] per CIA dimension; default by edge type, **overridable**; start from the spec §7 table, labelled non-authoritative.  [1.3 C]
- Asset-level source risk `Risk_d(S)` = **max** over S's in-scope triplets.  [1.2 A]
- `CascadingRisk_d(T) = max over upstream S of [ Risk_d(S) × Π τ_d(edges on path) ]`; max-product via −log τ shortest-path; drop τ=0; handle cycles (reachability). Direction: **depended-upon → dependents** (spec §8.6).
- `Total_d(T) = min(80, max(IndividualRisk_d(T), CascadingRisk_d(T)))`.
- Computed on **both raw and residual** risk.  [1.1 C]
- Record the contributing path per (T,d) for explainability (UR-F5); out-of-scope triplets do not propagate.

## 3. Architecture (evolve, not greenfield)
- **One shared TypeScript engine** = the single source of truth for the methodology (ported from v3 `lib/*` + the new cascading code). Runs **server-side** (authoritative for the API), reusable by the browser. No second implementation, no drift.
- **Backend: Node/TypeScript** — NOT the Python the spec §9 loosely suggests (spec permits the choice; TS reuses the engine).
- **Frontend: keep the v3 React stack** (Mantine, TanStack Query/Table, React Router, RHF/Zod), rewired to the real API.
- **All source fetching server-side** (NVD incl. keyed, OSV, EUVD, EPSS, KEV/CSAF) — one path, NVD key secret, CORS solved.  [3.3]
- **Vulnerability cache in the server DB** (TTL/timestamp).  [3.4]
- **Offline/stale:** source down → serve last cached, marked stale-as-of (NFR-3, 3.5). Server down → browser shows a **read-only** last-state snapshot ("offline, as-of"); offline is **view-only** (engine is server-side). Air-gapped → server runs locally + seeded data. Export/re-import reproduces an assessment anywhere (NFR-5).
- **Store:** SQLite default, PostgreSQL optional, behind a DB layer.  [3.1] **Single-tenant per deployment** (one instance per customer); org-id stamped for a possible future multi-tenant.  [3.2]

## 4. Identity & access
- **UI login:** built-in username/password accounts (self-contained; air-gapped-friendly). SSO/OIDC addable later.  [4.1 A]
- **API auth (machine/partners):** API keys (`X-API-Key`), one per consumer, revocable, hashed server-side, never logged/exported (NFR-2/§13). The browser UI uses the user's **login session**, never a static key.  [4.2 A]
- **Roles (4):** PRV **super-admin** (full control; customers never get it), **org-admin**, **analyst** (create/edit/run), **viewer/auditor** (read-only). Role-aware UI, server-enforced.  [4.3 A / 5.4 A]
- **Three distinct keys:** license key (right to run) · API key (machine→REST) · user login (human→UI).  [4.4]

## 5. Frontend specifics
- Drop MSW from the running app; **keep MSW for local dev + frontend tests**.  [5.1 B]
- Keep all v3 phases/screens, rewired to the API.  [5.2 A]
- New **"Dependencies & Cascading"** screen (graph editor + propagated results + contributing paths), placed after Mitigations; cascading also echoed in Dashboard + Export.  [5.3 A]

## 6. Scope step (kept + upgraded)  [2 C]
Single place for "what's in scope": all in by default; **auto-prune** vulns the xBOMGuard/pentest overlay marks VEX "not affected" (reason shown); analyst can manually prune/restore and override the VEX. Replaces the vestigial v3 applicability-override layer. Out-of-scope triplets feed neither risk nor cascading.

## 7. Integrations — V1 scope  [2 C; Integration Matrix]
- **In (V1, file-based):** xBOMGuard → RAP = CycloneDX 1.6 BOM + prioritised vulnerability/exposure overlay (label: "BOM & prioritised vulnerability/exposure overlay"). Pentest (ZELUS) → RAP = evidence file (sets confirmed flag + severity override).
- **In (V1, REST):** RAP → TDIR (PRV) handoff = asset criticality + risk scores + cascading paths (JSON). CTI (ENDO) → RAP = STIX 2.1 over REST — **built now on sample STIX**, flipped live when ENDO confirms fields (matrix: validated both sides).
- **Correlation:** stable shared identifiers `asset_id / CPE / purl / CVE`. **`bom-ref` is within-BOM only** (links overlay↔its own BOM), never a cross-tool key (UR-H1).
- **xBOMGuard prioritisation** (priority band, reason codes, recommended action) consumed as **enrichment** (display, test-candidate flags, scenario seeds) — **never replaces RAP's own computed risk**.

## 8. Asset intake — CPE relaxation  [R2: changes v3 C6.5]
v3 required ≥1 CPE per component. **V4 relaxes this:** a component needs **at least one of {CPE, purl}**; match by whichever is present (CPE → NVD, purl → OSV); CPE used where reliably derivable. Reason: xBOMGuard BOMs are purl-first and spec acceptance test #1 requires purl-only import. Keeps C6.5's intent (no un-matchable dead-end assets) without forcing CPE.

## 9. Distribution / ops
- **One Docker image**, two delivery modes from the same build: **you-hosted (SaaS)** — default for the D3.1 demo — and **customer on-prem**. Proprietary, closed-source (ship the built image, never source).
- **License:** offline **signed license file** (customer/expiry/seats; verified locally; no phone-home).  [6.1 A]
- **Channels:** private registry (PRV-issued credentials) + offline image file (`docker save`) for air-gapped.  [6.2 A+C]
- **Versioning:** semantic versions + immutable tags + build SHA stamped in app & exports (wires the real SHA — a v3 to-do).  [6.3 A]
- **Admin always PRV's** via super-admin role + license + private update channel.

## 10. Threat catalogs
- **V1 ships:** MAGERIT v3 (55), ENISA, MITRE ATT&CK for ICS.
- **Added when data supplied [3 B] (not blockers):** NIST SP 800-30 Rev.1 App.E (CSV/XLSX: `table` E-2/E-3, `event`, `description`; CIA assigned in-tool) and BSI elementary threats (CSV/XLSX: `id`, `name`, `description`, + `affects_C/I/A` if present).

## 11. Explicitly OUT of V1
Live REST auto-ingestion from partners (xBOMGuard/pentest file-based; CTI on sample STIX); NIST 800-30 + BSI until data lands; multi-tenancy; SSO/Keycloak; offline editing (read-only only); accumulating cascading mode (UR-F7 [V2]); strict CVSS 4.0 scoring (V1 keeps approximation + manual override → V2); anything owned by other tools (detection/monitoring/IR, SBOM generation, CTI production); full pilot production data. **EPSS + KEV enrichment are IN.**

## 12. R2 — divergences flagged
- Backend-centric (vs v3 client-only) — confirmed (spec D-2; required for partner REST + TRL-7 + the deferred-source cluster).
- Backend in **Node/TS**, not the spec §9 Python suggestion (spec permits).
- Residual stays **severity-only** (v3) — **rejecting spec §8.4's multiplicative-on-total** (the retired v2 model; violates the kernel).
- CPE **relaxed** to CPE-or-purl — changes v3 C6.5.
- Bands 8/29/80 and the probability **zone** dimension — carried from v3, restored into the spec (which omitted them).

## 13. Standing rules / working agreement
R1 context budget; R2 divergence disclosure. Pre-screen spec-lock; **Gate 4.5** extended to full-stack (frontend tsc/eslint/build + tests + dev-boot smoke; backend type-check/lint/test + API smoke; Docker build); atomic commits + push; file caps (220 soft / 260 hard). CLI builds; chat audits; human relays + approves.

## 14. Next steps (after approval)
1. New repo **`rap/`** (monorepo): `engine/` (shared TS), `backend/` (Node API), `frontend/` (React, seeded from `risk-frontend`), `docker/`, `docs/`.
2. **Rewrite docs clean for V4** — keep the methodology rationale; remove retired v2/v3 pipeline archaeology that would confuse the CLI; archive old v3 docs for reference.
3. Push.
4. Build ladder (define in the fresh chat): engine (kernel + cascading, with v3 parity tests) → backend (DB, auth, API) → source clients + cache → importers (CycloneDX/overlay/pentest) + CTI-on-sample → scope + risk + residual → cascading screen → frontend rewire + login + roles → exporters + scenarios + TDIR handoff → Docker packaging + license.

---

## A. Fresh-chat resume paste

```
You are resuming as STRATEGIST/AUDITOR for PRIVACT V4 — the AENAON RAP, an EVOLVE of the v3
React/TS risk tool into a containerised product (Node/TS backend + shared TS engine + React
frontend), single Docker image, proprietary/licensed, PRV always admin. Two-tool model: you
spec + audit in chat; Claude Code CLI builds; human relays + approves. English; no emojis.
PROPOSE-DON'T-APPLY: no repo edit/commit/push without per-action OK.

Read first (all in docs/v4/): PRIVACT-V4-RAP-Scope-Lock.md, RAP_Specification_for_Build.md,
AENAON_Integration_Matrix.csv. Also the v3 docs/ in the risk-frontend repo (methodology rationale).

Methodology kernel INVARIANT (from v3): Risk_d = Impact_d × ThreatApplicability_d(threat-CIA-only)
× Probability(per threat×type×zone) × Severity(round(cvss/2)); Max=max(C,I,A) 0-80; bands 8/29/80;
mitigation on Severity only (strongest D3FEND tactic delta, no stacking). NEW: cascading layer
Total_d = min(80, max(Individual, Cascading)), max-path over τ edges, raw+residual, paths recorded.

All architecture decisions are locked in the scope-lock doc (sections 3-12). Residual stays
v3 severity-only (reject spec §8.4). CPE relaxed to CPE-or-purl (changes v3 C6.5). V1 OUT list
in §11. Threat data files needed: NIST 800-30 App.E + BSI (§10).

STANDING RULES: R1 context (flag early, hand off before drift); R2 divergence (flag anything
against the core docs, by name, up front).

Task: create the rap/ repo, rewrite the docs clean for V4 (cut retired v2/v3 archaeology),
push on approval, then build per the §14 ladder. Start by confirming you've read the docs,
then propose the repo scaffold + the first commit.
```
