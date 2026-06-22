# PRIVACT Risk Assessment Platform — User Requirements (v3.1)

Actor: **Analyst** (risk assessor). Secondary: **Reviewer/Stakeholder** (reads results).
"Shall" = mandatory. Each requirement traces to the final requirement set R1–R10 and
the locked design decisions.

---

## A. Project Setup

- **UR-A1.** The analyst shall create a project with metadata and select the project's
  **sector** from the CISA critical-infrastructure sector list (e.g. Energy). [R6]
- **UR-A2.** The system shall not use project-level CIA priorities in any risk
  computation. [decision: dropped]

## B. Assets

- **UR-B1.** The analyst shall register assets manually or by importing a CycloneDX
  BOM; both paths shall produce identical asset records. [R1]
- **UR-B2.** The asset **type** taxonomy shall be the CycloneDX 1.6 component type
  enum plus Service; external taxonomies (e.g. MAGERIT) shall be crosswalked onto it.
  The term "asset type" shall be used everywhere (no "asset category"). [R1, R2]
- **UR-B3.** Every asset shall carry one or more **CPE** identifiers: read from the
  BOM `cpe` field on import, and/or assigned via a CPE picker searching the official
  NIST CPE Dictionary. [R3]
- **UR-B4.** Every asset shall carry a ROLFP impact matrix (5×3, values 0–4); the
  per-CIA impact shall be the column maximum. Every asset shall carry a Resides-In
  attribute. [methodology; decision]

## C. Threats

- **UR-C1.** The system shall offer a list of official threat sources (MAGERIT v3,
  ENISA, NIST SP 800-30 App. E, MITRE ATT&CK for ICS, BSI elementary threats); the
  analyst shall choose which sources to load. [R7]
- **UR-C2.** The analyst shall be able to add custom threats and edit any threat. [R7]
- **UR-C3.** Each threat shall carry CIA applicability flags. Sources that provide
  them natively (MAGERIT) shall pre-fill; otherwise the analyst shall assign them,
  assisted by a suggestion. [R7, decision]
- **UR-C4.** The analyst shall perform the **asset type ↔ threat** matching manually
  in a matrix, assisted by a non-binding pre-fill suggestion column (MAGERIT-derived
  crosswalk), with the originating source visible per threat. [R4, R7]
- **UR-C5.** The analyst shall enter **Threat Probability (0–4)** manually for every
  in-scope (threat × asset type × Resides-In) row; a non-binding suggestion column may
  be shown. The Threat Scales rubric shall be displayed inline. [R7, decision]

## D. Vulnerabilities

- **UR-D1.** The system shall match vulnerabilities to each asset **automatically** by
  querying official sources (NVD primary; ENISA EUVD; OSV for purl-based components)
  using the asset's CPEs. No manual vulnerability matching shall be required. [R4, R5]
- **UR-D2.** Each vulnerability shall display a **default severity (0–5) =
  round(CVSS/2)** and an **override column** where the analyst may set their own value
  per vulnerability; the override takes precedence. The Vulnerability Scales rubric
  shall be displayed inline. [R5]
- **UR-D3.** Vulnerabilities shall carry an exploited-in-the-wild indicator (CISA KEV)
  and, where derivable from CISA ICS advisories, **sector tags**; the project sector
  shall drive a relevance badge and an optional (default-off) filter. [R6]
- **UR-D4.** The analyst shall be able to add custom vulnerabilities. [R7]
- **UR-D5.** External queries shall run client-side with local caching; the system
  shall operate keyless by default and accept an optional user-provided NVD API key
  stored locally only. [decision]

## E. Scoping (pre-triplets)

- **UR-E1.** Before triplet generation, the system shall present every candidate row
  **asset / asset type / threat / vulnerability** (threats joined via the asset's type,
  vulnerabilities joined via the asset's CPE matches). [R8]
- **UR-E2.** All rows shall default to **in scope**; the analyst shall mark exclusions,
  with bulk actions and filters (severity, KEV, sector, source, text). [R8]

## F. Risk Calculation

- **UR-F1.** The system shall compute, per in-scope triplet and per CIA dimension:
  `Risk_d = Impact_d × ThreatApplicability_d × Probability × Severity`, with
  `Max Risk = max(C,I,A)` on the 0–80 scale and bands Low 0–8 / Medium 9–29 /
  High 30–80. [methodology]
- **UR-F2.** The risk table shall show per row only: asset id; threat id + CIA flags;
  threat probability; vulnerability id + severity; Risk C; Risk I; Risk A; Max Risk.
  Clicking a row shall open a popup with the full triplet detail and the exact
  arithmetic. [R9]

## G. Mitigations

- **UR-G1.** Per vulnerability, the system shall propose countermeasures from official
  sources: the CVE record's own remediation (patch/fixed version; NVD references,
  vendor CSAF, EUVD guidance, KEV required action) and defensive techniques via the
  CVE → CWE → MITRE D3FEND chain (including D3FEND for OT). [R10]
- **UR-G2.** Applying a **Remediate** countermeasure shall set the vulnerability's
  severity to 0. Applying a **Mitigate** countermeasure shall apply a default severity
  effect by D3FEND tactic (Isolate −3, Harden −2, Deceive/Detect −1, Evict/Restore
  none), overridable by the analyst per countermeasure. [R10, decision]
- **UR-G3.** The system shall recompute the affected triplets with the new severity
  and report the **risk reduction %** = (original − residual) / original. With multiple
  countermeasures on one vulnerability, the strongest single effect shall apply. [R10]

## H. Reporting & Interop

- **UR-H1.** The system shall provide a dashboard (band counts, heatmap by asset type ×
  threat type, top residual risks) and exports: report (PDF/XLSX/JSON), CycloneDX BOM,
  NIST OSCAL Assessment Results. [existing, retained]

## I. Non-functional

- **UR-I1.** Domain-generic: no sector- or case-study-specific data baked in; live
  queries follow the project's own CPEs. [R5 clarification]
- **UR-I2.** Methodology invariants (formula, scales 0–4/0–4/0–5, bands, ROLFP, phase
  names) shall never be altered by any feature, default, or suggestion. All suggested
  values are pre-fills requiring analyst confirmation or silence-acceptance, never
  hidden auto-commits into the formula.
- **UR-I3.** Vulnerability sync shall load progressively with per-asset progress and
  remain responsive at realistic scale (hundreds of CVEs per project); cached results
  shall load instantly.
- **UR-I4.** Every screen state relevant to review (tab, triplet) shall be deep-linkable.
- **UR-I5.** If an external source is unavailable (network/CORS), the system shall
  degrade gracefully per source, with a visible notice — never silent partial data.
