# PRIVACT Risk Assessment Platform v2.0 — User Manual

Σύντομη ξενάγηση οθόνη με οθόνη του εργαλείου. Το PRIVACT εφαρμόζει την δική του μεθοδολογία ανάλυσης κινδύνου (formula `Risk = Applicability × Impact × Probability × Severity`, 0-80 scale, Low/Medium/High bands) και τη συνδέει με διεθνή standards (CycloneDX, CWE, CVSS, ENISA, NIST, CIS, MITRE D3FEND, OSCAL) ως κοινή γλώσσα interoperability με άλλα cybersecurity tools.

Workflow: **Login → Projects → Setup → Assets → Review → Triplets → Mitigations → Dashboard → Export**.
Παράλληλα διαθέσιμο: **Standards Catalog** (global encyclopedia outside project context).

---

## 0. Login

Authentication entry. Email + password. Auth σήμερα είναι mock-based (MSW), real backend integration έρχεται στο E phase της roadmap.

---

## 1. Projects List (Global)

Λίστα όλων των projects του user. Click σε project ανοίγει το Setup phase.

**Top navigation bar**:
- Projects link
- **Standards Catalog** link (NEW στο v2)
- User menu

**Δράσεις**: "New Project" button → blank project, ξεκινάει στο Phase 1 Setup.

---

## 2. Phase 1 — Setup

Ορισμός του project context. Form με auto-save.

**Sections**:
1. **Project Identity**: name, description, target audience
2. **CIA Priorities**: 3 sliders 0-4 για Confidentiality, Integrity, Availability — αντικατοπτρίζει πόσο σημαντική είναι κάθε διάσταση για αυτό το project
3. **Threat Actor Profile** (NEW στο v2): 4 toggleable cards για τις ENISA actor categories:
   - **Hacktivists** — ιδεολογικά κίνητρα, public statements, leaks
   - **State-nexus Actors** — APTs, government-backed, espionage
   - **Cybercriminals** — financially motivated, ransomware, fraud
   - **Insider Threats** — εργαζόμενοι/contractors με privileged access

   Ο user επιλέγει ποιοι actors είναι σχετικοί στο context του project. Επηρεάζει filtering στο Phase 2.

**Δράσεις**: "Continue to Phase 1b" button.

---

## 3. Phase 1b — Assets & Links

Asset inventory + dependency relationships. **Δύο tabs**: Assets / Links.

### Assets tab

**Πίνακας** με columns:
- Name
- **Type** (NEW στο v2 — ήταν "Category" στο v1, τώρα CycloneDX 12-value vocabulary: Application, Library, Container, Operating System, Device, Data, Firmware, κλπ.)
- Resides In (PRIVACT logical grouping)
- Impact (computed C/I/A from ROLFP)
- Links (number of dependencies)

Services έχουν μπλε **"SERVICE"** badge (CycloneDX semantic split — απομονώθηκαν σε ξεχωριστή entity από Components).

**Δράσεις** (πάνω δεξιά):
- **"Add Asset"** (filled primary) → centered modal
- **"Import BOM"** (outline, NEW στο v2) → file upload modal

### Add Asset modal

**Layout** (1000px desktop, fullscreen mobile):

- **Kind toggle**: Component vs Service (hidden στο edit mode)
- **Two-column desktop**:

  **Αριστερά**: Identification + Additional Details
  - Name, Type (CycloneDX dropdown), Resides In, Comments
  - Additional Details collapsible: version, supplier, manufacturer, model, serialNumber, purl, group, licenses — type-conditional

  **Δεξιά**: Impact (ROLFP) grid
  - 5×3 matrix (Reputation/Operational/Legal/Financial/Personal × C/I/A)
  - Severity-colored segmented buttons 0-4: gradient gray → teal → yellow → orange → red, active button shows full color
  - "Impact (computed)" badges στο bottom

- **Service variant**: αντί για Type + Additional Details, εμφανίζονται service-specific fields (provider, endpoints, authenticated toggle, xTrustBoundary, data classifications)

### Import BOM modal (NEW στο v2)

Flow:
1. Click "Import BOM" → modal με file picker
2. Upload `.cyclonedx.json` (CycloneDX 1.4 / 1.5 / 1.6 accepted)
3. Parser validates → preview: "N components, M services, K dependencies will be imported"
4. Warnings αν υπάρχουν (e.g. "3 components without ROLFP — defaults to zeros")
5. ⚠ "This will REPLACE current assets"
6. ⓘ "Triplets will be cleared, recompute in Phase 3"
7. Confirm → assets/services/links replaced

Round-trip με Export: BOM που κατεβάζεις από Phase 4c → importable σε άλλο project για equivalent inventory.

### Links tab

Asset dependency relationships (π.χ. FHIR API → depends on → MariaDB CDR).

Δράσεις: "Add Link" → modal με from/to asset selectors.

---

## 4. Phase 2 — Review

Threats + Vulnerabilities scope assessment. **ΤΡΕΙΣ tabs** στο v2 (ήταν 2 στο v1).

### Tab 1: Threats

**Filter dropdowns**:
- "Filter by ENISA Category" (NEW στο v2) με counts
- "Filter by Threat Actor" (NEW στο v2) multi-select με counts

**Κάθε threat row**:
- Name + ENISA category breadcrumb chip
- Color-coded Threat Actor chips (purple/blue/red/amber)
- Description, in-scope toggle

**Click threat → ReviewDrillModal**:
- Description
- **Standards section** (NEW): expanded ENISA hierarchy tree (Category → Subcategory με active node highlight)
- **Threat Actors section** (NEW): 4 actor cards, applicable ones με full color, non-applicable grayed
- External link σε ENISA Threat Landscape

### Tab 2: Vulnerabilities

**Filter**: "Filter by CWE Pillar" (NEW στο v2) με counts.

**Κάθε vuln row**:
- Name
- **CWE chip** link στο MITRE (π.χ. `CWE-79`)
- **Colored CVSS Base Score badge** — color matches band
- Applicable categories, in-scope toggle

**Click vuln → ReviewDrillModal**:
- Description
- **Standards section**:
  - Expanded CWE hierarchy tree (Pillar → Class → Base)
  - Enhanced CVSS section: big colored score, vector parsed με labeled metrics, link σε first.org/cvss/calculator pre-loaded
- External link σε MITRE CWE page

### Tab 3: Per-Asset Applicability (NEW στο v2)

Override capabilities πέρα από category-based defaults.

- Asset selector dropdown πάνω
- Sections για threats + vulnerabilities
- Κάθε row: checkbox με current effective state, "Inherited" ή "Overridden ★" badge, override dropdown (Mark applicable / Mark not applicable / Reset to default)
- "Reset all overrides for this asset" bulk action
- "Save & recompute" trigger Phase 3 recomputation

**Use case**: MariaDB CDR ανήκει σε "data" category, inheritance-άρει SQL Injection. Αλλά είναι behind WAF + parameterized queries → mark as not-applicable for this specific asset → triplets για αυτό το pair εξαφανίζονται.

---

## 5. Phase 3 — Triplets

Risk computation phase. Triplet = (Asset × Threat × Vulnerability) combo που είναι applicable.

**Compute button** → engine runs με PRIVACT formula `Risk = Applicability × Impact × Probability × Severity` (0-80 scale).

**Layout**:
- Filters: by risk band (Low/Medium/High), by asset, by threat, by vuln
- Sort: by score desc/asc
- Triplet cards/rows

**Κάθε triplet row**:
- **Score badge** color-coded by band
- Asset name
- Threat (inline ENISA breadcrumb + Threat Actor chips)
- Vulnerability (inline CWE breadcrumb + CVSS badge)
- Risk band
- **★ icon** αν έχει CVSS Environmental override (NEW στο v2)

**Click triplet → TripletDetailModal**:

- Header με όλα τα standards refs visible
- InfoCard grid: Asset / Threat / Vulnerability details
- **CVSS Environmental Adjustment section** (NEW στο v2, collapsible):
  - Default: "Using catalog severity (CVSS Base X.X → Severity Y)"
  - Customize: Modified Base Metrics dropdowns + Security Requirements (CR/IR/AR auto-populated από project CIA) + Real-time recalculation
  - Save → triplet score updates με environmental severity, ★ icon εμφανίζεται
- Suggested Actions section (από engine match logic)

**Use case**: ίδιο CWE-89 SQL Injection (CVSS 9.8) applies σε public-facing DB και σε internal isolated DB. Στο public-facing → stays Critical. Στο internal → adjust Modified Attack Vector σε "Adjacent" + AR=Low → Environmental score 7.2 → severity drops to High. Same vuln, different deployment contexts.

---

## 6. Phase 4a — Mitigations

Apply countermeasures στους triplets. **Three framework filters stackable** στο v2.

**Filter row** (NEW):
- "NIST Function" με counts
- "CIS Control" με counts
- "D3FEND Tactic" με counts
- "Reset all filters" button

**Κάθε action row**:
- Action name + description
- **Up to 3 colored framework chips** inline:
  - NIST blue (π.χ. `NIST PR.AC-1`)
  - CIS indigo (π.χ. `CIS-6`)
  - D3FEND pink (π.χ. `D3FEND Harden`)

**Click action → MitigationDetailModal**:
- Description
- **3 Standards sub-sections**, one per framework, each με expanded hierarchy tree + external link (csrc.nist.gov / cisecurity.org / d3fend.mitre.org)
- "Apply to triplets" multi-select

Drawer panel ανά triplet δείχνει applied mitigations + residual score.

---

## 7. Phase 4b — Dashboard

Risk visualization + KPIs.

**Sections**:
- **Heatmap**: matrix probability × impact, με triplet density + color coding by band
- **KPI cards**: total triplets, by-band breakdown, high-risk count, mitigation coverage %
- **Per-asset risk profile**: list με risk-weighted assets
- **Per-threat distribution**: ποια threats παράγουν τα περισσότερα high-risk triplets

---

## 8. Phase 4c — Export

Standards-compliant deliverables. **ΠΕΝΤΕ download buttons** στο v2 (ήταν 3 στο v1).

**Buttons στο ReportHeader**:

1. **PDF** — formatted risk assessment report
2. **XLSX** — spreadsheet με όλους τους πίνακες
3. **JSON** — internal data dump
4. **CycloneDX** (NEW στο v2) — CycloneDX 1.6 BOM file
   - Filename: `{project-slug}-bom-{date}.cyclonedx.json`
   - Consumable από: Dependency-Track, OWASP Bomber, security scanners, OSCAL toolchains
   - Περιέχει: components, services, dependencies, vulnerabilities, x-privact:* extensions
5. **OSCAL** (NEW στο v2) — NIST OSCAL 1.1.2 Assessment Results file
   - Filename: `{project-slug}-oscal-ar-{date}.oscal.json`
   - Consumable από: eMASS, Xacta, Atlasity, RegScale, broader OSCAL ecosystem
   - Περιέχει: observations, risks, findings, characterizations με CVSS facets, x-privact:* extensions

**Sections του report**:
- Project overview + CIA priorities + Threat Actor Profile
- Asset inventory (με Type column)
- Threats in scope (με ENISA hierarchy refs)
- Vulnerabilities in scope (με CWE + CVSS columns)
- Triplets by band
- Applied mitigations
- Risk register

---

## 9. Standards Catalog (Screen 11, NEW στο v2)

Global encyclopedia των standards που χρησιμοποιεί το tool. Accessible από top nav, **outside του project context**.

**4 Domain tabs**:

### Assets
CycloneDX 12 component types (flat list με usage stats).

### Vulnerabilities
CWE hierarchy (~25 entries): 8 Pillars + intermediate Classes + Bases.

### Threats — sub-tabs:
- **ENISA Threat Taxonomy** (~37 entries): 12 top-level + 25 subcategories
- **ENISA Threat Actors** (4 entries): Hacktivists / State-nexus / Cybercriminals / Insider

### Actions — sub-tabs:
- **NIST** (CSF v2.0 ή 800-53): Functions/Families + commonly-referenced controls
- **CIS Controls v8**: 18 Controls + Safeguards
- **MITRE D3FEND**: 7 Tactics + Techniques

**Layout**:
- Left: hierarchical tree (40%) με expand/collapse, search filter
- Right: detail panel (60%)

**Detail panel για κάθε entry**:
- ID + name + type
- Parent path breadcrumb
- Description
- Source citation (ENISA ETL 2022 / MITRE CWE / NIST CSF v2.0 / κλπ.)
- **"Used in seed by"** list: ποια vulns/threats/actions στο tool αναφέρονται σε αυτό το entry (cross-reference visibility)
- **External link** σε authoritative source

**Use case**: Stakeholder ρωτάει "πώς κατηγοριοποιούνται οι vulnerabilities;" → click Standards Catalog → Vulnerabilities tab → CWE hierarchy tree → instant authoritative reference που εξηγεί τη standards foundation.

---

## v2 delivery overall — scorecard

| Δυνατότητα | v1 | v2 |
|---|---|---|
| Asset taxonomy | 7 internal categories | 12 CycloneDX types + Service entity |
| Asset import | ❌ | ✅ CycloneDX 1.4/1.5/1.6 |
| Vulnerability categorization | Internal severity 0-5 | CWE hierarchy + CVSS 4.0 Base + Environmental |
| Threat categorization | Internal categories | ENISA Threat Taxonomy 2022 hierarchy + STIX shape-prep |
| Threat actor profiling | ❌ | ✅ ENISA 4-category model |
| Mitigation framework refs | Implicit στο seed | NIST + CIS + D3FEND visible + filterable + browsable |
| Per-asset severity override | ❌ | ✅ CVSS Environmental UI |
| Per-asset applicability override | ❌ | ✅ Override layer πάνω από category defaults |
| Standards exploration | ❌ | ✅ Global Catalog Browser screen |
| Standards-compliant exports | 3 (PDF/XLSX/JSON) | 5 (+ CycloneDX 1.6 + OSCAL 1.1.2) |
| Methodology preservation | — | ✅ Formula, scales, bands, ROLFP, phases — UNCHANGED |

**Bottom line**: εργαλείο που εξωτερικά μιλάει 9 διεθνή standards (CycloneDX 1.6, CWE, CVSS 4.0, ENISA Threats, ENISA Actors, NIST CSF, CIS v8, MITRE D3FEND, OSCAL 1.1.2), εσωτερικά εφαρμόζει την PRIVACT μεθοδολογία ως κορμό, και διαθέτει standards-aware UI που εκθέτει τη standards foundation σε CISO audience και EU reviewers.

---

## Audience & use cases

**Primary user**: CISO ή information security manager σε healthcare / critical infrastructure organization. Εκτελεί structured risk assessment σε projects/systems, με όλη τη γλώσσα standards-aligned για επικοινωνία με auditors και regulators.

**EU reviewer use case**: ανοίγει το tool, βλέπει Phase 4c export options, κατεβάζει OSCAL Assessment Results, ανοίγει σε GRC toolchain — instant cross-tool interop verification.

**Industry interop**: organization δίνει στο tool CycloneDX BOM από Dependency-Track ή cdxgen → asset inventory populated αμέσως → risk assessment τρέχει με PRIVACT methodology → exports OSCAL → feeds GRC platform.

---

*Document version: aligned με v2.0 tag στο branch v2-standards-aligned. Last updated: 2026-06-02.*
