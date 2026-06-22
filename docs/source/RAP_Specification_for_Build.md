# Risk Assessment Platform (RAP) — Complete Specification

**Tool ID:** T3.4-PRV-RAP · **Owner:** PRIVACT (PRV) · **Project:** AENAON (GA 101249723) · **Service:** Threat & Risk Assessment (TRA, GA Objective 5) · **TRL:** 7

> **How to use this document (for Claude Code / Claude CLI).** This is the single source of truth for (re)building the RAP. Read it top to bottom before scaffolding. Sections 5–8 define *what must be true* (requirements, data model, algorithms) and are authoritative. Section 9 (tech stack) is a concrete **recommendation** you may follow unless the owner specifies otherwise. Anything marked **[ASSUMPTION]** or **[CONFIRM]** is a gap the owner must validate — do not treat it as fixed fact. Build incrementally in the order of Section 18 (build plan).

---

## 1. Product overview

The RAP is a web-based cyber risk assessment platform. It takes a structured inventory of a system's assets, automatically discovers their known vulnerabilities, maps applicable threats, and computes a quantified, per-dimension (Confidentiality / Integrity / Availability) risk score for every asset–threat–vulnerability combination. It then recommends officially-sourced countermeasures and recomputes residual risk. For AENAON it additionally computes **cascading (propagated) risk** across asset dependencies, in line with the Grant Agreement, which assigns both individual and cascading risk to the RAP.

The methodology is **domain-generic** (sector-agnostic by construction). The first pilot is an **offshore wind farm** (sector = Energy), but nothing in the core engine is wind-specific.

### What the tool produces
- A quantified **risk register**: every asset × threat × vulnerability triplet scored per C/I/A on a 0–80 scale, plus a per-asset max risk.
- A **mitigation plan**: recommended countermeasures with effectiveness and recomputed residual risk.
- **Cascading-risk paths**: how a compromise on one asset propagates to dependent assets.
- Machine-readable and human-readable **exports** (JSON, PDF, XLSX, CycloneDX, NIST OSCAL).

### Position in the AENAON tool chain
- **Inputs from other partners:** asset/vulnerability data from xBOMGuard (CLX), validated-vulnerability evidence from the Pentesting tool (ZELUS), and known-threat context from the CTI platform PolemAIrchOS (ENDO).
- **Outputs to other partners:** risk scenarios to the Threat Hunting workbench (CLX) and the Cyber Range (ZELUS); risk scores and cascading paths to PRV's own TDIR platform (T3.5) for monitoring and incident response.

---

## 2. Personas & target users

| Persona | Description | Expertise | Primary use |
|---|---|---|---|
| Security analyst / risk assessor | Runs assessments, reviews and overrides automatic results, produces the risk register and mitigation plan. | Technical | Day-to-day primary user |
| Cybersecurity provider | Operates the RAP on behalf of an asset owner. | Technical | Service delivery |
| Offshore wind operator (security team) | Consumes the risk register for their own infrastructure. | Mixed | Decision-making |
| EU reviewer / auditor | Reviews outputs and methodology. | Mixed | Evidence/compliance |

Default target user for D3.1: **Cybersecurity provider**, **Technical** expertise.

---

## 3. Scope

**In scope (D3.1 V1):**
- Asset import (CycloneDX) and manual asset creation.
- Automatic vulnerability matching against official sources.
- Threat catalog management and applicability.
- Individual risk scoring per C/I/A (triplet model).
- Cascading-risk computation over asset dependencies (**RAP owns this — see Decision D-1**).
- Countermeasure recommendation and residual-risk recomputation.
- Exports (JSON, PDF, XLSX, CycloneDX, OSCAL).
- Ingestion of xBOMGuard overlay; **[CONFIRM]** ingestion of Pentest evidence and live CTI may use sample data if partner schemas are not finalised in time.

**Out of scope (D3.1 V1):**
- Production live auto-ingestion of Pentest/CTI if partner schemas are not finalised.
- Full pilot production data.
- Anything owned by other tools (detection, monitoring, incident response → TDIR; SBOM generation → xBOMGuard; CTI production → PolemAIrchOS).

---

## 4. Key concepts (read before requirements)

- **Asset:** a component of the system under assessment (software, hardware, service, OT device). Identified by CPE and/or purl, with a type and a dependency/containment link to a parent.
- **Triplet:** the unit of risk = one (asset × threat × vulnerability). Risk is computed per triplet, per CIA dimension.
- **Individual risk:** the risk to one asset considered in isolation.
- **Cascading (propagated) risk:** how a compromise of one asset flows to assets that depend on it, along dependency links.
- **ROLFP impact:** the business-impact model — five categories (Reputation, Operational, Legal, Financial, Personal/safety) scored per CIA.
- **Default | Override:** every automatically-derived value (severity, probability, effectiveness, transmission coefficient) is a *default* the analyst can override. Analyst-owned scores are the philosophy of the tool.

---

## 5. Functional requirements

Requirements are grouped and numbered (`UR-x`). "shall" = mandatory for V1 unless marked **[V2]**.

### A. Asset management
- **UR-A1** The system shall import assets from a **CycloneDX 1.6 BOM** (JSON), creating one asset per component.
- **UR-A2** The system shall allow **manual** creation/editing of assets with identical structure to imported ones.
- **UR-A3** Each asset shall store: stable `asset_id`, name, type, version, zero-or-more **CPE** (2.3) values, zero-or-more **purl** values, optional `bom-ref` (within-BOM reference), a **parent/host link** ("resides/belongs to"), and optional sector-relevance tags.
- **UR-A4** The system shall provide a **CPE picker** backed by the official NVD CPE dictionary for manual assets.
- **UR-A5** The system shall import xBOMGuard's **prioritised vulnerability/exposure overlay** (see §10.1) and associate overlay entries to assets via shared identifiers (`bom-ref`/`purl`/`CPE`/`assetRef`).

### B. Vulnerability discovery
- **UR-B1** The system shall **automatically** match vulnerabilities to each asset by querying official sources using the asset's CPE (primary) and purl.
- **UR-B2** Sources shall include: **NVD CVE API 2.0** (primary, CPE-based), **ENISA EUVD**, **OSV.dev** (purl-based), and **CISA KEV** (known-exploited flag).
- **UR-B3** For each matched vulnerability the system shall store: CVE id, CVSS base score and vector, derived **severity 0–5 = round(CVSS/2)**, EPSS (if available), KEV flag, source, CWE id(s).
- **UR-B4** The system shall accept **confirmed-vulnerability evidence** from the Pentesting tool (see §10.2) and use it to set a `confirmed/exploited` flag and to **override** severity for the matching (asset, CVE). **[CONFIRM build target vs V2]**
- **UR-B5** NVD access shall work **keyless** by default; the deployment may supply an NVD API key (held server-side) to raise rate limits.

### C. Threat modelling
- **UR-C1** The system shall maintain threat catalogs sourced from: **MAGERIT v3**, **ENISA**, **NIST SP 800-30 Appendix E**, **MITRE ATT&CK for ICS**, and **BSI**.
- **UR-C2** Each threat shall carry **CIA applicability flags** (does it affect C? I? A?) and a **probability 0–4** that can vary by asset type.
- **UR-C3** The system shall consult a **live known-threats pool from the CTI platform (PolemAIrchOS/ENDO)** and merge/augment the threat catalog from it. **[CONFIRM format with ENDO; STIX/TAXII assumed]** **[V2 acceptable if not ready]**

### D. Risk computation (individual)
- **UR-D1** For each asset the system shall compute, per CIA dimension *d*, an **Impact_d** = the maximum of the five ROLFP category values in that dimension (each 0–4).
- **UR-D2** For each triplet (asset × threat × vulnerability) and each *d*, the system shall compute:
  `Risk_d = Impact_d × ThreatApplicability_d × Probability × Severity`
  where ThreatApplicability_d ∈ {0,1}, Probability ∈ 0–4, Severity ∈ 0–5.
- **UR-D3** The system shall compute **Max Risk = max(Risk_C, Risk_I, Risk_A)**, range **0–80**.
- **UR-D4** All inputs to the formula shall be **viewable and overridable** by the analyst (Default | Override), with overrides persisted and clearly flagged.

### E. Countermeasures & residual risk
- **UR-E1** For each vulnerability the system shall recommend countermeasures by mapping **CVE → CWE → MITRE D3FEND**.
- **UR-E2** Each countermeasure shall have an **effectiveness** (default, overridable) used to reduce risk.
- **UR-E3** Residual risk shall apply the **strongest single applicable countermeasure effect (max, not cumulative sum)** per triplet/dimension.
- **UR-E4** The system shall display individual residual risk alongside raw risk.

> **PRV V4 LOCK (overrides UR-E3 wording):** residual acts on the **Severity factor only** — re-run the formula with severity reduced by the strongest single D3FEND tactic delta (Isolate −3, Harden −2, Deceive/Detect −1, Evict/Restore/Model 0; override [−5,0]); no stacking. This is the v3 methodology kernel. The spec §8.4 multiplicative-on-total form is **rejected** (it is the retired v2 model). See scope-lock §1/§12.

### F. Cascading (propagated) risk — RAP-owned (Decision D-1)
- **UR-F1** The system shall build a **dependency graph** where nodes are assets and edges come from the asset parent/host links (UR-A3) plus optional explicit dependency edges (data-flow, authentication, hosting).
- **UR-F2** Each edge shall carry a **transmission coefficient τ ∈ [0,1] per CIA dimension** (default by edge type, overridable).
- **UR-F3** For each target asset T and dimension *d*, the system shall compute cascading risk by **max-path propagation**:
  `CascadingRisk_d(T) = max over all upstream source assets S (path S→…→T) of [ Risk_d(S) × Π τ_d(edges on path) ]`
- **UR-F4** The system shall compute **Total_d(T) = max( IndividualRisk_d(T), CascadingRisk_d(T) )**, **capped at 80**.
- **UR-F5** The system shall expose the **contributing paths** for each cascading result (which source, which edges, attenuated value) for explainability.
- **UR-F6** The cascading engine shall handle cycles safely (treat the graph as the reachability DAG; ignore zero-τ edges; cap path length or detect revisits).
- **UR-F7** **[V2]** Optional iterative/accumulating propagation mode (bounded probabilistic-OR combiner) for "many small upstream risks add up"; off by default.

> **PRV V4 LOCK:** `Risk_d(S)` = max over S's in-scope triplets [1.2]. Propagate **both raw and residual** source risk [1.1]. Direction: depended-upon → dependents (§8.6). τ defaults from §7, labelled non-authoritative [1.3]. Edges = BOM containment/dependency + analyst-added explicit edges [1.4].

### G. Outputs & reporting
- **UR-G1** The system shall produce a **risk register** (all triplets, individual + cascading + residual) viewable and filterable in the UI.
- **UR-G2** The system shall **export** the assessment as JSON, PDF, XLSX, **CycloneDX** (assets + vulnerabilities, optionally VDR/VEX), and **NIST OSCAL**.
- **UR-G3** The system shall generate **risk scenarios** (prioritised, machine-readable) for downstream tools (TDIR, CLX hunting, Cyber Range) including asset refs, threat/MITRE ATT&CK technique where known, severity/band, related CVE, and **cascading paths**.
- **UR-G4** The system shall produce a **risk/cascading handoff payload** for the TDIR platform (see §10.5).

### H. Cross-cutting
- **UR-H1** All cross-tool correlation shall rely on **stable shared identifiers**: `asset_id`, `CPE`, `purl`, `CVE`. `bom-ref` is unique only within a single BOM and shall **not** be used as a cross-tool key.
- **UR-H2** The system shall record provenance for every value (source, default-or-overridden, timestamp).

---

## 6. Non-functional requirements

- **NFR-1 Deployment:** containerised; deployable as Container / Cloud / On-premise (preferred: Container). Base OS Ubuntu.
- **NFR-2 API & auth:** exposes a REST API secured with an **API key**. (See Decision D-2 on the client-side-vs-backend reconciliation.)
- **NFR-3 Offline-tolerance:** assessment must remain usable when official sources are unreachable (graceful degradation; cached results; clear "stale" indicators).
- **NFR-4 Explainability:** every score must be traceable to its inputs and to whether it was default or overridden.
- **NFR-5 Reproducibility:** an assessment plus its overrides must be exportable and re-importable to reproduce identical results.
- **NFR-6 Performance:** handle assessments of at least a few thousand triplets interactively.
- **NFR-7 Data protection:** no secrets in exports; API key never echoed; respect source API terms.

---

## 7. Domain & data model

> Field types are indicative. Persist with stable IDs. All "score" fields store both the computed default and any override.

### Asset
| Field | Type | Notes |
|---|---|---|
| asset_id | string (stable) | Cross-tool key |
| name | string | |
| type | enum/string | e.g. software, library, service, OT device, host |
| version | string | |
| cpe[] | string[] | CPE 2.3 |
| purl[] | string[] | Package URL |
| bom_ref | string | Within-BOM only (not a cross-tool key) |
| parent_ref | asset_id | "resides/belongs to" (containment/host) |
| sector_tags[] | string[] | e.g. Energy |
| impact_rolfp | matrix 5×3 | rows = Reputation, Operational, Legal, Financial, Personal; cols = C,I,A; values 0–4 |

### Threat
| Field | Type | Notes |
|---|---|---|
| threat_id | string | |
| source_catalog | enum | MAGERIT v3 / ENISA / NIST SP 800-30 E / ATT&CK for ICS / BSI / CTI(ENDO) |
| name | string | |
| applies_C / applies_I / applies_A | bool | CIA applicability |
| probability_by_type | map<asset_type,int 0–4> | default probability per asset type |
| attack_pattern_ref | string | optional MITRE ATT&CK technique id |

> **PRV V4 LOCK:** probability is per **(threat × asset type × zone)** — the v3 Purdue/ISA-95 zone dimension is retained (the spec's `probability_by_type` is extended with zone). See scope-lock §1.

### Vulnerability (per asset)
| Field | Type | Notes |
|---|---|---|
| cve | string | |
| cvss_base | number 0–10 | |
| cvss_vector | string | |
| severity | int 0–5 | = round(cvss_base/2), overridable |
| epss | number 0–1 | optional |
| kev_flag | bool | CISA KEV |
| source | enum | NVD / EUVD / OSV |
| cwe[] | string[] | |
| confirmed | enum | none / pending / confirmed-exploited (from Pentest) |
| evidence_ref | string | optional, from Pentest |

### Triplet (computed)
| Field | Type |
|---|---|
| asset_id, threat_id, cve | refs |
| impact_C/I/A | int 0–4 |
| probability | int 0–4 |
| severity | int 0–5 |
| risk_C/I/A | int |
| max_risk | int 0–80 |
| residual_risk_C/I/A, residual_max | int |

### DependencyEdge
| Field | Type | Notes |
|---|---|---|
| src_asset_id, dst_asset_id | refs | src supports/affects dst |
| edge_type | enum | hosted-on / reads-data-from / authenticates-via / depends-on |
| tau_C / tau_I / tau_A | number 0–1 | transmission coefficient, default by type, overridable |

### CascadingResult (computed)
| Field | Type |
|---|---|
| asset_id, dimension | refs |
| cascading_risk | int 0–80 |
| total_risk | int 0–80 |
| contributing_paths[] | list of {source_asset_id, edges[], attenuated_value} |

### Countermeasure
| Field | Type | Notes |
|---|---|---|
| id | string | |
| cwe_ref / d3fend_ref | string | from CVE→CWE→D3FEND |
| effectiveness | number 0–1 | default, overridable |
| applies_to | triplet/dimension | |

### Default τ table (recommended starting values — overridable)
| edge_type | τ_C | τ_I | τ_A |
|---|---|---|---|
| hosted-on / runs-on | 0.3 | 0.4 | 0.8 |
| reads-data-from | 0.9 | 0.8 | 0.3 |
| authenticates-via | 0.8 | 0.8 | 0.4 |
| depends-on (generic) | 0.5 | 0.5 | 0.5 |

---

## 8. Core algorithms (authoritative)

### 8.1 Impact
For asset A and dimension d ∈ {C,I,A}: `Impact_d(A) = max over the 5 ROLFP categories of impact_rolfp[category][d]`. Range 0–4.

### 8.2 Severity
`severity = round(cvss_base / 2)` → 0–5. Overridable; Pentest "confirmed-exploited" may raise it (UR-B4).

### 8.3 Individual risk (per triplet, per dimension)
```
Risk_d = Impact_d × ThreatApplicability_d × Probability × Severity      # 0..80
Max_Risk = max(Risk_C, Risk_I, Risk_A)                                  # 0..80
```

### 8.4 Residual risk
For each triplet/dimension, apply the single strongest applicable countermeasure:
```
factor = 1 − max(effectiveness of applicable countermeasures)     # strongest single effect, no stacking
Residual_d = round(Risk_d × factor)
```

> **PRV V4 LOCK — REJECTED.** §8.4 above is the retired v2 multiplicative-on-total model. V4 uses the v3 kernel instead: residual acts on **Severity only** → `Residual_d = Impact_d × ThreatApplicability_d × Probability × residualSeverity`, where `residualSeverity = max(0, severity − strongest D3FEND tactic delta)`; strongest single, no stacking. See scope-lock §1/§12.

### 8.5 Cascading risk (max-path propagation) — primary mode
```
For each target asset T, dimension d:
    CascadingRisk_d(T) = max over upstream sources S (S reaches T) of:
        Risk_d(S) × Π( τ_d(e) for each edge e on the path S→…→T )
    Total_d(T) = min(80, max(IndividualRisk_d(T), CascadingRisk_d(T)))
```
Implementation notes: build adjacency from `parent_ref` (reverse: parent → child as "hosted-on") plus explicit `DependencyEdge`s. Use a longest-attenuated-path search (e.g., DFS/Dijkstra on −log(τ) weights = shortest path → max product). Drop edges with τ_d = 0. Detect revisited nodes to avoid cycles. Record the winning path per (T,d) for UR-F5.

A pure-Neo4j implementation is acceptable but **not required**; an in-memory adjacency-list implementation is sufficient for V1.

### 8.6 Worked example (use as acceptance test — see §15)
Host `Edge Node` has `Risk_A = 30`. Edge `Edge Node →(hosted-on)→ Data Manager` with `τ_A = 0.8`. Then `CascadingRisk_A(Data Manager) = 30 × 0.8 = 24`. If Data Manager's own `IndividualRisk_A = 10`, then `Total_A(Data Manager) = max(10,24) = 24`, with contributing path `[Edge Node →(hosted-on, τ_A=0.8)→ Data Manager]`.

---

## 9. System architecture & technology (recommended)

> The actual current RAP stack is not fully specified in the source docs; the following is a concrete, buildable **recommendation** consistent with the known constraints (containerised, REST API, API key, Ubuntu, the export formats, and the official-source queries). Confirm with the owner before locking.

> **PRV V4 LOCK:** stack is **Node/TypeScript backend + shared TS engine + React frontend** (evolve of v3), NOT Python/FastAPI. The spec permits this choice. See scope-lock §3.

Recommended stack (spec original): **Backend** Python + FastAPI; **Frontend** React + TypeScript; **Store** SQLite by default, PostgreSQL optional; **Packaging** Docker (single image serving API + static SPA); **Export libs** server-side. Queries to official sources run **server-side**.

Repository layout (PRV V4 lock): `rap/` monorepo — `engine/` (shared TS), `backend/` (Node API), `frontend/` (React, seeded from risk-frontend), `docker/`, `docs/`.

---

## 10. External interfaces (inputs & outputs)

All payloads correlate via shared identifiers (UR-H1). Integration mechanism: REST API (API key) and/or file exchange.

### 10.1 Input — xBOMGuard → RAP (agreed with CLX)
Two-tier interface:
1. **Basic:** CycloneDX 1.6 BOM (components, versions, `bom-ref`, `purl` where available, `CPE` where available or reliably derivable, asset/system/release context).
2. **Extended overlay:** prioritised vulnerability/exposure data referencing the same identifiers, delivered as **CycloneDX VDR/VEX** *or* xBOMGuard JSON. Indicative fields: `componentRef/bom-ref, assetRef, name, version, purl, CPE, CVE, CVSS, EPSS, KEV flag, VEX/applicability status, priority score/band, reason codes, recommended action`.

Rules: **purl preferred**, **CPE not mandatory per component** but required where reliably derivable. The overlay is used for **enrichment/prioritisation**, not as the sole source of truth; RAP's own matching remains the base. De-duplicate by CVE + identifier. **[CONFIRM: AENAON profile not yet signed]**

> **PRV V4 LOCK (confirmed with CLX email):** interface label = "xBOMGuard → RAP: BOM & prioritised vulnerability/exposure overlay". CPE **not mandatory** → V4 requires CPE-or-purl per component (changes v3 C6.5). xBOMGuard priority consumed as enrichment, never replacing RAP's own risk. V1 = file-based.

### 10.2 Input — Pentesting (ZELUS) → RAP (schema offered by ZELUS, flexible)
```json
{
  "asset_id": "string",
  "cve": "CVE-2024-XXXX",
  "validation_status": "confirmed|pending",
  "severity": "low|medium|high",
  "evidence": "string",
  "timestamp": "ISO-8601",
  "bom_ref": "string (optional)",
  "cpe": "string (optional)"
}
```
RAP behaviour: for the matching (asset, CVE), set `confirmed` and apply a severity **override**. `evidence`/`timestamp` stored as provenance. V1 = file-based. **[CONFIRM]**

### 10.3 Input — CTI PolemAIrchOS (ENDO) → RAP
A **pool of known threats the RAP consults** (feeds the threat side, not IOCs). Maps onto the threat catalog (UR-C3). Format **STIX 2.1 over TAXII 2.1**. **[CONFIRM with ENDO]** — PRV V4 lock: built now on **sample STIX**, flipped live when ENDO confirms (Integration Matrix: validated both sides, REST).

### 10.4 Outputs — risk scenarios (RAP → CLX hunting / ZELUS Cyber Range)
JSON, machine-readable: prioritised scenarios with asset refs, threat/MITRE ATT&CK technique (where known), severity/band, related CVE, and **cascading paths**. Mechanism: REST API (API key) / file export.

### 10.5 Output — risk handoff (RAP → TDIR, internal PRV)
JSON over internal REST API (API key) or file:
```json
{
  "asset_id": "string",
  "criticality": "int 0-4 (max ROLFP)",
  "risk": { "C": 0, "I": 0, "A": 0, "max": 0 },
  "cascading_paths": [
    { "target": "asset_id", "dimension": "A",
      "source": "asset_id", "edges": ["hosted-on"], "value": 24 }
  ]
}
```

### 10.6 Exports (standalone)
JSON, PDF, XLSX, CycloneDX (assets + vulnerabilities; optional VDR/VEX), NIST OSCAL.

---

## 11. REST API (recommended surface)

Auth: `X-API-Key` header on every call (machine clients); browser UI uses the user login session.
```
POST /assessments                       create assessment
POST /assessments/{id}/assets:importCycloneDX   body: CycloneDX BOM
POST /assessments/{id}/overlay:import   body: VDR/VEX or xBOMGuard JSON
POST /assessments/{id}/pentest:import   body: array of §10.2 objects
POST /assessments/{id}/vulns:refresh    re-query NVD/EUVD/OSV/KEV
GET  /assessments/{id}/risk             risk register (triplets + individual + residual)
GET  /assessments/{id}/cascading        cascading results + paths
POST /assessments/{id}/overrides        persist analyst overrides
GET  /assessments/{id}/scenarios        risk scenarios (§10.4)
GET  /assessments/{id}/handoff          TDIR handoff (§10.5)
GET  /assessments/{id}/export?format=json|pdf|xlsx|cyclonedx|oscal
GET  /cpe:search?q=                     NVD CPE dictionary picker
```

---

## 12. Data flows (summary)

1. Assets in (CycloneDX import or manual) → 2. xBOMGuard overlay merged → 3. Auto vulnerability matching (NVD/EUVD/OSV/KEV by CPE/purl) → 4. Pentest evidence merged (confirmed/override) → 5. Threats mapped (catalogs + CTI pool) → 6. ROLFP impact set per asset → 7. Individual risk per triplet → 8. Countermeasures + residual → 9. **Cascading propagation over dependency graph** → 10. Risk register + scenarios + TDIR handoff + exports.

---

## 13. Security & deployment
- Container image, Ubuntu base; deploy Container/Cloud/On-premise.
- REST API protected by API key (server-side secret store; never logged or exported).
- Optional NVD API key held server-side.
- Outbound HTTPS to NVD/EUVD/OSV/KEV/D3FEND; must degrade gracefully if blocked.
- No PII required by the engine; ROLFP "Personal" is an impact rating, not personal data.

---

## 14. Glossary
CPE — Common Platform Enumeration. purl — Package URL. CVE — Common Vulnerabilities and Exposures. CVSS — Common Vulnerability Scoring System. EPSS — Exploit Prediction Scoring System. KEV — CISA Known Exploited Vulnerabilities. CWE — Common Weakness Enumeration. D3FEND — MITRE defensive technique knowledge base. VEX/VDR — Vulnerability Exploitability eXchange / Disclosure Report. ROLFP — Reputation, Operational, Legal, Financial, Personal. TRA — Threat & Risk Assessment (GA service). τ — transmission coefficient.

---

## 15. Acceptance criteria / test scenarios

1. **Import:** importing a CycloneDX 1.6 BOM with N components creates N assets; components with only `purl` are still imported (no CPE required).
2. **Matching:** an asset with a known-vulnerable CPE returns its CVE(s) from NVD with CVSS and KEV flag; a purl-only OSS component returns CVE(s) from OSV.
3. **Severity:** CVSS 9.8 → severity 5; CVSS 5.0 → severity 3 (round(CVSS/2)).
4. **Risk formula:** Impact_A=4, applicable A threat, Probability=4, Severity=5 → Risk_A=80; Max_Risk=80.
5. **Residual:** (PRV V4 lock) strongest D3FEND tactic delta on severity → re-run formula; strongest single, no stacking.
6. **Cascading:** the §8.6 Edge-Node example yields CascadingRisk_A(Data Manager)=24 and Total_A=24 with the correct contributing path.
7. **Pentest override:** a `confirmed` pentest record for (asset, CVE) flips its `confirmed` flag and raises severity.
8. **Export round-trip:** export to JSON then re-import reproduces identical scores (incl. overrides).
9. **Offline:** with official sources blocked, the assessment still opens and shows cached results marked stale.

---

## 16. Assumptions, decisions & open items

**Decisions (settled):**
- **D-1 (cascading ownership):** The **RAP computes individual *and* cascading risk**. TDIR consumes the results and does **not** recompute. Confidence: High.

**To reconcile / confirm:**
- **D-2 (architecture reconciliation):** backend-centric architecture confirmed (PRV V4: Node/TS backend, server-side queries, single Docker image).
- **O-1** xBOMGuard "AENAON profile" not yet signed (§10.1).
- **O-2** Pentest ingestion: §10.2 JSON vs CycloneDX VEX (UR-B4).
- **O-3** CTI format with ENDO (§10.3) — STIX/TAXII; built on sample first.
- **O-4** Tech stack confirmed = Node/TS (replaces §9 Python recommendation).

---

## 17. Source of truth note
This spec is derived from: RAP Tool Documentation and User Requirements v3.1, the D4.14 Risk Analysis Matrixes, the AENAON Grant Agreement (GA 101249723), the AENAON architecture diagram and Integration Matrix, and direct integration facts from the PRV developer and partner emails (CLX, ZELUS). PRV V4 locks are in `PRIVACT-V4-RAP-Scope-Lock.md`.

---

## 18. Suggested build plan for Claude Code
1. Scaffold repo (§9 PRV layout); define the shared engine + data model.
2. Implement the **risk engine** as pure functions with unit tests for §8 (formulas, PRV-locked residual) and §15.3–15.6 + v3 parity vectors.
3. CycloneDX import (UR-A1) + manual assets (UR-A2) — CPE-or-purl.
4. Source clients NVD/EUVD/OSV/KEV (UR-B), server-side, with caching + offline degradation.
5. Threat catalogs (UR-C1/C2) seeded (MAGERIT/ENISA/ATT&CK ICS; NIST/BSI when data lands).
6. Individual risk + residual (UR-D/E, PRV-locked).
7. **Cascading engine** (UR-F, §8.5) + path explainability + the §8.6 acceptance test.
8. Overlay/Pentest importers (§10.1/10.2); CTI on sample STIX.
9. Exporters (UR-G2) + scenarios + TDIR handoff (§10.4/10.5).
10. REST API (§11) + API-key auth; React UI rewired to the API; cascading graph view; login + roles.
11. Docker packaging (single image) + offline signed license.
