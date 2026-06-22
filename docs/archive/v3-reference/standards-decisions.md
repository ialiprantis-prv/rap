# PRIVACT v2 — Standards Alignment Decisions

> **v3 status annotations (C9c, 2026-06-18).** This file is the v2 standards
> record. Two v3 deltas supersede parts of it (annotated inline below, not
> deleted):
> - **NIST CSF v2.0 + CIS Controls v8 are now REFERENCE-ONLY.** They remain
>   browsable in `/catalog` (NIST and CIS sub-tabs, served via
>   `components/catalog/CatalogTreeView` + `lib/catalogNodes` +
>   `lib/catalogFrameworkConfig`) as a crosswalk aid, but are **NOT wired into the
>   v3 risk-scoring pipeline**. The v3 mitigation model is **D3FEND-anchored**
>   (CVE → CWE → D3FEND); see `docs/v3-blueprint.md` C8. A "Reference only — not
>   wired into risk scoring" Alert surfaces in /catalog when NIST or CIS is
>   selected. Any "NIST/CIS pipeline" or "Controls feed mitigation" language below
>   is superseded.
> - **The v2 multiplicative-residual export adapters were RETIRED (C9c).** The v2
>   `cyclonedxAdapter` + `oscalAdapter` (and the whole v2 export handler/hook
>   stack) were deleted; v3 exports are generated client-side from the LIVE
>   residual model via `lib/export/cyclonedxV3` + `lib/export/oscalV3`
>   (+ `cyclonedxComponents` / `oscalV3Entities`). See `docs/v3-blueprint.md`
>   C9b/C9c.

## Executive summary

v2 makes PRIVACT **interoperable with established security standards** without
throwing away the working internal model from v1. The approach is **hybrid
adoption**: where a standard has a clear, mature shape for something we already
do (vuln severity → CVSS, asset interchange → CycloneDX, risk export → OSCAL),
we adopt it — usually at the **edges** (import/export adapters, augmentation
fields) so the internal data shape and the methodology stay intact. Where no
standard covers what we do (ROLFP impact, our risk formula, the phase
methodology), we **keep the PRIVACT-specific model** and document it as a
deliberate extension. Preservation is guaranteed by git: **v1.0 is tagged** on
the pre-alignment HEAD and stays deployable, while all v2 work happens on the
**`v2-standards-aligned`** branch in bounded, sweepable commits.

## Locked standards

| # | Standard | Version | Domain | Adoption mode |
|---|---|---|---|---|
| 1 | CycloneDX | 1.6 | Asset modeling / SBOM + HBOM | Ingress/egress adapter — import/export only; internal `Asset` shape preserved |
| 2 | CWE | 4.x (Top 25 seed) | Vulnerability classification | Augmentation — optional `cweRefs[]` on existing vulns |
| 3 | CVSS Base | 4.0 | Vulnerability severity | Replaces internal 0–5 severity scale |
| 4 | CVSS Environmental | 4.0 | Per-asset severity + CIA priorities | Adopt — CIA → CR/IR/AR + Modified Base (codifies Option C) |
| 5 | CVSS Safety (S) | 4.0 | Safety-critical scoring | Conditional — surfaced only for safety-critical projects |
| 6 | ENISA Threat Taxonomy | 2022 | Threat classification | Formalize existing partial seed to the full set |
| 7 | ENISA Threat Landscape | 4-category agent model | Threat actor profiling | **NEW** capability — closes user req 2.2 |
| 8 | OSCAL | Assessment Results profile | Risk / assessment export interop | Partial — new export endpoint alongside existing |

EPSS (exploit probability) is **deferred** — see Open items.

## Per-domain decisions

### Asset modeling — CycloneDX 1.6 — ✅ IMPLEMENTED (v2 commits 02 + 03)

> **v3 (C9c):** the v2 `cyclonedxAdapter` export path was RETIRED; its 3
> component builders (`assetComponent`, `serviceEntry`, `linkDependency`) were
> relocated to `lib/export/cyclonedxComponents.ts` and the v3 BOM is emitted by
> `lib/export/cyclonedxV3` reading the live model. Import (`cyclonedxImporter`)
> is unchanged.

**Status:** export adapter shipped in commit 02 (`v2 [02/N]`); internal model
gone CDX-native in commit 03 (`v2 [03/N]`).

**Internal shape now CycloneDX-native:** `Asset` carries `type:
CycloneDxComponentType` as its primary classification, with `bomRef` precomputed
and the standard CDX optional fields (`version`, `supplier`, `manufacturer`,
`model`, `serialNumber`, `countryOfManufacture`, `purl`, `cpe`, `group`,
`licenses`, `externalReferences`) available as a skeleton. **Application-api
items bifurcated** into a separate `Service` entity (separate `serviceStore`
collection, separate `GET /projects/:id/services` endpoint). IDs are preserved
across the split (`ast-2`, `ast-4`, `ast-6`, `ast-11` are now Services with the
same ids), so links + computed triplet IDs that reference these IDs resolve via
cross-collection lookup. PRIVACT methodology data lives in a typed
`privact: { residesIn, rolfp, legacyCategory }` extension on both entities;
ROLFP is **the actual 15-cell matrix** (not flat scalars as drafted — that
would have been data loss).

**Backward-compat mirror:** the v1 top-level fields (`categoryId`, `residesIn`,
`comments`, `rolfp`) are kept on `Asset` and kept in sync by addAsset/
updateAsset so the existing AssetEditPane form + auto-save + handler API stay
unchanged through this commit. Legacy mirrors are slated for removal in commit
#4 (UI refresh).

**Engine continuity:** triplet generation iterates both collections via a
normalized `{id, name, legacyCategory, rolfp}` view; matching still keys on
`legacyCategory` (v1 applicability matrix unchanged — per-type matrix lands in
commit #6). Verified: demo-2 produces **exactly the same 75 triplets** as v1.
Mitigation selections (keyed by triplet id, IDs preserved) survive the split.

**Adapter simplified:** the CycloneDX 1.6 export adapter is now near
pass-through — internal `type` is CDX-native, Services come natively from the
services collection (no more dual-emit), link dependencies resolve to the
correct `asset-*` vs `service-*` bom-ref via cross-collection lookup. Adapter
dropped from 178 → 153 lines.


We adopt CycloneDX as the **interchange format**, not the internal model. The
integration is an **adapter at the edges** (β option): an *ingress* adapter
parses an uploaded BOM into our internal `Asset[]`, and an *egress* adapter
serializes our assets into a CycloneDX 1.6 BOM on export. Our internal `Asset`
shape — `categoryId`, `residesIn`, `comments`, and the **ROLFP** matrix — stays
exactly as it is in v1.

What this changes for our code: new **import/export endpoints** (and UI to
trigger them), plus a **properties extension** convention. Anything PRIVACT
tracks that CycloneDX has no native field for (ROLFP cells, our risk metadata)
rides along as namespaced properties using an **`x-privact:` prefix** (e.g.
`x-privact:rolfp.reputation.c`), so a round-trip preserves our data and external
tools ignore what they don't understand.

What it does **not** change: the internal `Asset` type, the ROLFP scoring UI,
the asset table, or how the engine consumes assets. CycloneDX is a wire format,
not our runtime model.

**Migration mapping — asset category → CycloneDX component type:**

| PRIVACT category | CycloneDX 1.6 `type` |
|---|---|
| Database | `application` (DBMS) + `data` for the datastore classification |
| Application/API | `application` |
| Container | `container` |
| Container Network | `platform` |
| Hardware | `device` |
| OS | `operating-system` |
| TCP/IP | `platform` (network stack) |

**HBOM applicability:** the medical-IoT demo (Hospital IoT Network) is the
natural showcase for CycloneDX's **Hardware BOM** usage — edge devices, the
gateway, and sensors map to `device`/`firmware` components, which is exactly the
HBOM use case CycloneDX 1.6 strengthened.

### Vulnerability taxonomy — CWE + CVSS 4.0 — ✅ IMPLEMENTED (v2 commit 01)

**Status:** shipped on `v2-standards-aligned`. The 18-entry vuln catalog was
enriched **in place** (IDs `VU-xx` preserved to keep the 284 cross-references
in threatSeed/controlSeed/countermeasureSeed intact — triplets are computed,
not seeded, so a Phase 3 recompute regenerates them with the new severities).
14 entries carry `cweRefs` + a CVSS 4.0 base (score + severity + representative
vector); 4 operational-gap entries (no-malware-protection, physical access,
SPOF, missing-backup) keep their name with no CWE/CVSS. `defaultSeverity` is
derived from the CVSS base via `lib/cvss.legacySeverityFromCvss`
(0.0→0 · 0.1–3.9→1 · 4.0–5.4→2 · 5.5–6.9→3 · 7.0–8.9→4 · 9.0–10.0→5) — the
Phase 3 risk formula is unchanged. Badges (CWE chips → MITRE link, colored
CVSS chip) shipped across Review/Triplets/Mitigations/Export via
`VulnStandardsBadges`. `Triplet` gained optional `vulnCweRefs`/`vulnCvss` so
the triplet + mitigation modals render standards without an extra fetch
(populated at generation time).


**CWE as augmentation (β option):** existing vulnerabilities gain an optional
`cweRefs[]` field (e.g. `["CWE-89", "CWE-79"]`). We do not restructure the vuln
catalog around CWE; we annotate it. The **CWE Top 25** is imported as seed
reference data so the picker/preview can show recognizable IDs.

**CVSS 4.0 Base Score replaces the internal 0–5 severity scale.** Each vuln
carries a CVSS 4.0 base vector + computed Base Score (0.0–10.0). This **codifies
Option C** — no custom severity invention; we consume the standard scoring.

**Migration mapping — internal severity 0–5 → CVSS 4.0 Base (first-pass):**

| Internal severity | CVSS Base (band) | Approx. score |
|---|---|---|
| 0 | None | 0.0 |
| 1 | Low | 0.1–3.9 |
| 2 | Low/Medium | 4.0–5.9 |
| 3 | Medium | 5.0–6.9 |
| 4 | High | 7.0–8.9 |
| 5 | Critical | 9.0–10.0 |

(Seed values get real CVSS vectors where known; the table is the fallback for
hand-entered v1 data.)

**Per-asset severity adjustment via CVSS Environmental Score:** the same base
vuln scores differently per asset using **Modified Base Metrics** + **Security
Requirements** (CR/IR/AR). This is how PRIVACT expresses "the same flaw matters
more on the patient database than on a dev sandbox" in standard terms instead of
a bespoke multiplier.

### CIA priorities → CVSS Security Requirements

PRIVACT's per-project CIA priorities map directly onto CVSS 4.0 **Security
Requirements**: `confidentiality → CR`, `integrity → IR`, `availability → AR`.

**Scale alignment — internal 0–4 → CVSS X/L/M/H:**

| Internal CIA (0–4) | CVSS Requirement |
|---|---|
| 0 | Low (L) |
| 1 | Low (L) |
| 2 | Medium (M) |
| 3 | High (H) |
| 4 | High (H) |

The existing CIA priorities UI (Setup screen) **stays as-is** — the user still
sets 0–4 sliders. The values are simply **exported as CVSS-aligned** CR/IR/AR
when feeding the Environmental Score and the OSCAL/CycloneDX exports.

### Threat taxonomy — ENISA continuation

Our seed already uses a **partial ENISA** taxonomy (Nefarious Activity,
Unintentional Damage, Eavesdropping/Interception, Outages, Physical Attack,
Disaster). Decision: **keep it and formalize to the full ENISA 2022 taxonomy
set** rather than swap taxonomies. Watch item: ENISA's taxonomy is **under
revision** — monitor and re-align when the new version publishes (Open items).

### Threat Agent Profiling — NEW (closes user req 2.2)

v1 has no threat-actor concept; v2 adds one using the **ENISA 4-category agent
model**: **Hacktivists / State-nexus / Cybercriminals / Insider**.

- **New entity `ThreatActor`**: `category`, `motivation`, `capabilities`.
- **New UI**: per-project threat-actor configuration — either an extension of
  Phase 1 (Scope) or a small new sub-phase (decision deferred to the
  implementation iteration).
- This is the one genuinely new *capability* in v2 (the rest is re-shaping
  existing data). It closes **user requirement 2.2 (threat agent profiling)**,
  previously unsatisfied.

### Risk export — OSCAL Assessment Results (partial)

> **v3 (C9b/C9c):** the v2 server-side `GET /report.oscal.json` handler +
> `oscalAdapter` were RETIRED. OSCAL is now generated client-side from the live
> v3 model via `lib/export/oscalV3` (+ `oscalV3Entities`); same Assessment Results
> profile, `bom-ref` references, and CWE/CVE/CVSS citation. The rest of this
> section's contract still describes the output shape.

New endpoint **`GET /report.oscal.json`** producing an **OSCAL Assessment
Results** profile. The existing `/report.{pdf,xlsx,json}` exports are
**preserved unchanged**. The OSCAL output references CycloneDX assets by
**`bom-ref`** and cites **CWE / CVE / CVSS** in findings, so the three standards
compose into one interoperable assessment artifact. Scope is **partial** — only
the Assessment Results profile, not full OSCAL adoption (Open items).

### Safety parameter — CVSS 4.0 Safety metric

CVSS 4.0 added a **Safety (S)** supplemental/environmental metric for systems
where a vuln can cause physical harm. PRIVACT surfaces it **conditionally**:

- Project setup gains a **"safety-critical context?"** toggle (medical, OT, ICS,
  etc.).
- When enabled, the CVSS Environmental UI surfaces the **Safety** parameter so
  scoring can reflect human-safety impact. When off, it stays hidden to avoid
  cluttering non-safety projects.

### Countermeasures — MITRE D3FEND — ✅ IMPLEMENTED (v3 C8)

D3FEND is the countermeasure vocabulary for the v3 Mitigations screen. Adopted
as a **bundled, versioned snapshot** (D3FEND 1.4.0, ontology released
2026-03-31), generated offline from the official artifacts (`d3fend.csv` +
`d3fend.json` from `d3fend.mitre.org/ontologies/`) into a generated-data seed
(`src/lib/d3fend/d3fendSnapshot.ts`), served through a SourceAdapter-conformant
adapter (same family as the NVD/OSV vuln sources).

- **Snapshot-only (live stubbed).** The C8 probe found the D3FEND API CORS-clean
  (`ACAO: *`) but with **no per-CWE inference route** — the only CWE linkage is
  inside the static ontology download. So the live layer is stubbed behind the
  interface (EUVD pattern); phase E may swap a proxied/live layer in. Snapshot
  version is surfaced as provenance in the UI.
- **CWE→countermeasure is a faithful SPARSE overlay (10 CWEs).** D3FEND does not
  publish, and the ontology does not yield by naive client traversal, a broad
  CWE→countermeasure mapping: direct `weakness-of`→defensive-technique links
  exist for only a handful of (mostly memory-safety) CWEs, and transitive
  closure degenerates to all-`Harden` noise. We ship ONLY the faithful direct
  links and, per the honesty doctrine, fall back to the **full 271-technique
  tactic-grouped catalog** (the picker universe) with an explicit "no
  CWE-specific D3FEND mapping" note — never an invented suggestion.
- **Effectiveness defaults are PRIVACT-defined, not D3FEND-published** (Isolate
  −3 · Harden −2 · Deceive/Detect −1 · Evict/Restore/Model 0), labelled as such
  in the UI, analyst-overridable [-5, 0]. Composition is STRONGEST-ONLY (never
  additive). Mitigation acts on the **Severity factor only** — the methodology
  kernel is invariant.

## What stays PRIVACT-specific

These have **no standard equivalent** that fits, and stay as deliberate
extensions:

- **ROLFP impact scoring** — broader than CVSS's CIA-only impact (Reputation,
  Operational, Legal, Financial, Personal × C/I/A). Exported as `x-privact:`
  properties.
- **Probability scale** — internal 0–4 (future: EPSS adoption — Open items).
- **Risk formula** — `Risk_dim = Applicability × Impact × Probability ×
  Severity`, `RiskScore = max(Risk_C, Risk_I, Risk_A)`.
- **Bands** — Low (0–8), Medium (9–29), High (30–80).
- **Methodology phase structure** — Setup → Assets → Review → Triplets →
  Mitigations → Dashboard → Export (and the PhaseNav that ties them together).

## Migration scope summary

- **~8–10 commits** expected, spread across multiple sessions.
- Each commit is **bounded, reviewable, and sweepable** (Gate 4.5 each time).
- **v1.0 stays accessible throughout** via the tag — any commit can be compared
  against it, and the `main`/v1 deploy is unaffected.

## Open items / decisions deferred to a specific iteration

- **EPSS adoption** for the probability scale — separate later iteration.
- **ENISA taxonomy revision watch** — re-align when the revised taxonomy
  publishes.
- **OSCAL full adoption** — v2 does **partial** (Assessment Results profile
  only); broader OSCAL (catalogs, SSP) is out of scope for now.
- **CWE 4.x version-tracking strategy** — how we pin/update the CWE version our
  `cweRefs[]` validate against.
- **Threat-actor placement** — Phase 1 extension vs. dedicated sub-phase
  (decided at implementation time).
