# PRIVACT Risk Assessment Platform — Tool Documentation

Target state: v3.1. Audience: anyone who wants to understand what the tool offers,
how it works, what it connects to, and the assumptions behind it.

---

## 1. What the tool is

PRIVACT is a web-based cyber risk assessment platform. It guides an analyst from an
asset inventory to a quantified, per-CIA-dimension risk register and a mitigation plan,
using official external catalogs and live vulnerability intelligence instead of manual
data entry wherever an official source exists. It is domain-generic: any sector, any
system. The first case study is an offshore wind farm (energy sector), but nothing in
the tool is bound to it.

What it offers in one paragraph: you register your assets (or import them from a
CycloneDX BOM), the tool pulls each asset's real vulnerabilities live from official
databases via the asset's CPE identifiers, you select threat catalogs and match threats
to your asset types, you scope what is relevant, and the tool computes a 0–80 risk score
per (asset, threat, vulnerability) triplet, per CIA dimension — then recommends
officially-sourced countermeasures per vulnerability and recomputes the residual risk.

---

## 2. The methodology core (invariant)

For every triplet (asset × threat × vulnerability), per dimension `d ∈ {C, I, A}`:

```
Risk_d = Impact_d × ThreatApplicability_d × Probability × Severity
Max Risk = max(Risk_C, Risk_I, Risk_A)        range 0–80
```

- **Impact_d** (0–4): from the asset's ROLFP matrix — 5 dimensions (Reputation,
  Operational, Legal, Financial, Personal) × 3 CIA columns; `Impact_d` = max of the
  5 ROLFP values in column `d`.
- **ThreatApplicability_d** (0/1): whether the threat affects dimension `d`
  (the threat's CIA flags).
- **Probability** (0–4): likelihood of the threat against this asset type
  (Threat Scales rubric).
- **Severity** (0–5): severity of the vulnerability (Vulnerability Scales rubric).
- **Bands:** Low 0–8 · Medium 9–29 · High 30–80.
- **Phases:** Setup → Assets → Review → Triplets → Mitigations → Dashboard → Export.

---

## 3. End-to-end workflow

### 3.1 Setup
Project metadata plus the project **sector** (CISA critical-infrastructure sector list,
e.g. Energy). The sector drives relevance badges on vulnerabilities (see 3.4); it never
hides data by default.

### 3.2 Assets
- Assets are registered **per CycloneDX**: imported from a CycloneDX BOM or created
  manually. The PRIVACT **asset type** taxonomy = the CycloneDX 1.6 component `type`
  enum (application, container, operating-system, device, firmware, library, framework,
  platform, data, file, device-driver, cryptographic-asset, machine-learning-model)
  plus Service. Asset taxonomies of external catalogs (e.g. MAGERIT) are crosswalked
  onto this list.
- Every asset carries its **CPE identifiers** (one or more): read from the BOM
  component's `cpe` field on import, or assigned manually via a **CPE picker** that
  searches the official NIST CPE Dictionary (vendor / product / version → pick).
  CPEs are what connect an asset to its real vulnerabilities.
- Every asset carries its **ROLFP impact matrix** (15 cells, each 0–4) and a
  **Resides-In** attribute (deployment tier, e.g. Edge Node / Orchestrator) used in
  probability assignment and, later, in countermeasure context.

### 3.3 Threats (Review)
- **Threat library, multi-source.** The user is shown the available official sources
  and chooses which to load: MAGERIT v3 (backbone — ships per-threat CIA flags, threat
  type, deliberate/accidental origin, and affected asset types natively), ENISA Threat
  Taxonomy / Threat Landscape, NIST SP 800-30 Appendix E threat events, MITRE ATT&CK
  for ICS techniques, BSI IT-Grundschutz elementary threats. Custom threats can always
  be added; any threat can be edited.
- **CIA flags are analyst-owned.** MAGERIT pre-fills them; for every other source the
  analyst assigns them, with a tool suggestion based on the threat's nature.
- **Asset-type ↔ threat matching is manual, assisted.** The matrix is pre-filled from
  MAGERIT's native threat→asset-type associations through the PRIVACT crosswalk
  (MAGERIT types → CycloneDX types) shown as a *suggestion column*; the analyst
  confirms, adds, or removes every match. The match also records which source the
  threat came from.
- **Threat Probability (0–4) is entered manually** per in-scope (threat × asset type ×
  Resides-In) row. A non-binding *suggestion column* shows a derived hint (ENISA threat
  landscape prevalence + NIST 800-30 adversarial / non-adversarial logic + exposure of
  the Resides-In tier). The Threat Scales rubric is displayed inline so the analyst
  always sees what 0–4 mean.

### 3.4 Vulnerabilities (Review — automatic)
- **Asset ↔ vulnerability matching is automatic.** For each asset, the tool queries
  official sources by the asset's CPEs (and purl where present) and assembles a
  normalized record per CVE: description, CVSS score/vector, EPSS, exploited-in-the-wild
  flag (CISA KEV), sector tags, source references.
- **Default severity** (0–5) = `round(CVSS / 2)`. A second column lets the analyst
  **override** the severity per vulnerability; the override always wins.
- **Sector relevance** is shown as a badge (derived from CISA ICS advisories that
  reference the CVE and carry sector tags). An optional filter can restrict to the
  project's sector; it is off by default so that real risk is never silently hidden.
- The Vulnerability Scales rubric is displayed inline.

### 3.5 Scoping (pre-triplets)
A single screen lists every candidate row — **asset / asset type / threat /
vulnerability** — i.e. the threats the analyst matched per asset type, joined with the
vulnerabilities each asset actually has. All rows start **in scope**; the analyst
excludes what does not apply. Filters: severity, exploited (KEV), sector badge, source,
free text.

### 3.6 Triplets & Risk Calculation
One screen: triplets are generated from the in-scope rows and the table shows, per row,
the compact essentials — asset id · threat id + CIA flags · probability ·
vulnerability id + severity · Risk C · Risk I · Risk A · Max Risk — with the band
coloring. Clicking a row opens a popup with the full triplet detail and the exact
arithmetic, so every number is auditable.

### 3.7 Mitigations
Per vulnerability the tool proposes countermeasures from official sources:
- **Remediate** — the fix published in the CVE record itself (patch / fixed version,
  from NVD references, vendor CSAF advisories, EUVD mitigation guidance, KEV required
  action). Applying it sets the vulnerability's severity to **0** (the patched version
  is outside the CVE's vulnerable configuration).
- **Mitigate** — defensive techniques inferred through the official chain
  CVE → CWE → MITRE D3FEND (D3FEND's CWE-inference API), including the D3FEND for OT
  extension, plus advisory guidance. Each carries a **default effectiveness** by its
  D3FEND tactic: Isolate −3 · Harden −2 · Deceive / Detect −1 · Evict / Restore none.
  The analyst can override the effect per countermeasure.
The triplet is recomputed with the new severity; **risk reduction % =
(original − residual) / original**. When several countermeasures apply to one
vulnerability, the strongest single effect is used (no stacking).

### 3.8 Dashboard & Export
Risk summary, band counts, heatmap (asset type × threat type), top residual risks.
Exports: on-screen report, PDF / XLSX / JSON, CycloneDX BOM (assets + in-scope
vulnerabilities), NIST OSCAL Assessment Results.

---

## 4. External connections

| Connection | What it provides | How it is used |
|---|---|---|
| NVD CVE API 2.0 (NIST) | CVEs per CPE, CVSS, KEV fields, CWE refs | Live query per asset CPE; primary vuln source |
| NVD CPE Products API | Official CPE dictionary | CPE picker for manual assets |
| ENISA EUVD | EU vulnerability records, EPSS, exploited flag, mitigation guidance | Second official source; EU resilience |
| OSV.dev | Vulnerabilities by purl | Coverage for open-source library components from BOMs |
| CISA KEV | Known-exploited flag + required action | Badge + mitigation input (embedded in NVD responses) |
| CISA ICS advisories (CSAF, GitHub) | Sector tags per advisory/CVE | Sector relevance badges |
| MITRE D3FEND (+OT) API | Countermeasures per CWE; tactic categories | Mitigation recommendations + default effectiveness class |
| MAGERIT v3 catalog | Threats with CIA, type, origin, asset types | Threat library backbone + matching pre-fill |
| ENISA taxonomy/ETL, NIST 800-30 App.E, ATT&CK ICS, BSI elementary threats | Additional threat catalogs | Optional threat sources in the picker |
| CycloneDX 1.6 | BOM import/export, asset types, CPE field | Asset inventory + interop |
| NIST OSCAL 1.1.2 | Assessment Results export | GRC interop |

Architecture: all external queries run **directly from the browser** through a
per-source adapter layer with an IndexedDB cache, retry/backoff, and per-source
enable/disable. No backend is required; the adapter interface is identical to what a
future backend would serve, so a backend can take over transparently if scale demands
it. NVD works keyless by default (per-user IP rate limits); users may store their own
free NVD API key locally ("bring your own key") for faster syncs. Sources whose CORS
posture blocks browser calls are disabled with a notice (verified at build time).

---

## 5. Assumptions and conventions (documented decisions)

1. **CVSS → Severity 0–5:** `round(CVSS/2)`. The 0–5 scale and the formula are
   unchanged; the default value is technically derived, and the analyst override is
   always available and always wins.
2. **CIA flags are an analyst attribute**, not a source attribute. Sources that ship
   them (MAGERIT) pre-fill; all others are assigned with a suggestion.
3. **The MAGERIT→CycloneDX type crosswalk is PRIVACT-defined**, not official; it is
   documented, shown as a suggestion, and always user-overridable.
4. **Sector relevance is an enrichment, not a gate.** CPE matching already restricts
   results to the project's actual products; sector badges prioritize, they do not hide.
5. **Effectiveness defaults are PRIVACT-defined.** No standard quantifies
   countermeasure effectiveness; defaults derive transparently from the D3FEND tactic
   and the analyst sets the final value. Remediation→0 is the only objectively grounded
   automatic effect.
6. **Strongest-only composition** of multiple countermeasures on one vulnerability
   (conservative; avoids unrealistic stacking to zero).
7. **All suggestions are pre-fills, never auto-commits.** Every score that enters the
   formula is analyst-owned.
8. **Generic by construction:** live queries follow whatever CPEs the project's assets
   carry; no domain-specific data is baked in.
9. Dropped as non-methodology: project-level CIA priorities; the threat-actor
   (hacktivist/state) taxonomy. Threats are classified by type and
   deliberate/accidental origin only.

---

## 6. UI patterns for ease of use

- **Default | Override dual columns** everywhere a value can be sourced (severity,
  effectiveness, CIA suggestions, matching pre-fill, probability hint): the analyst
  sees where a number came from and keeps the final say.
- **Pre-filled matrices instead of blank grids:** matching and probability screens
  start populated with suggestions to validate, not empty cells to fill.
- **Opt-out scoping:** candidate rows start in scope; excluding is one click. Bulk
  actions for both.
- **Inline scale rubrics:** the Threat Scales (0–4) and Vulnerability Scales (0–5)
  definitions are always visible next to the inputs they govern.
- **Compact rows + detail popup:** tables show the minimum that identifies a row and
  its scores; the full record and the exact arithmetic are one click away.
- **Badges over walls of text:** KEV-exploited, sector relevance, source of origin,
  custom/kept provenance.
- **Progressive loading with cache:** first vulnerability sync streams in per asset
  with progress; subsequent visits are instant from the local cache.
- **Keep-then-map:** analysts enrich only what they keep in the project, never entire
  external catalogs.
- **Deep links** to every tab and triplet for review handoffs.
