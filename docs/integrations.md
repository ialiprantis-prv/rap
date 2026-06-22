# Integrations

---

## Correlation identifiers

All cross-tool correlation uses stable shared identifiers: `asset_id`, `CPE`, `purl`, `CVE`.

`bom-ref` is a within-BOM reference. It links an overlay entry to its own BOM's component.
It is NOT a cross-tool key and must not be used as one. Use `purl`, `CPE`, or `asset_id`
to correlate data across tools.

---

## Asset intake: CPE-or-purl relaxation

V3 required at least one CPE per component. V4 relaxes this: a component needs at least
one of {CPE, purl}. The system matches by whichever identifier is present:
- CPE -> NVD (primary vulnerability source).
- purl -> OSV (purl-based vulnerability source).

CPE is used where it is reliably derivable. purl is accepted as the sole identifier for
components where CPE is not available or not reliable. The intent of the original CPE rule
(no un-matchable dead-end assets) is preserved: a component with neither CPE nor purl
contributes no triplets and is flagged.

Reason: xBOMGuard BOMs are purl-first, and acceptance test #1 (purl-only import) requires
this relaxation.

---

## Scope step

The Scope step (between Review and Triplets) is the single place for in/out-of-scope
decisions.

All assets and vulnerabilities are in scope by default. Auto-prune rule: vulnerabilities
that the xBOMGuard or pentest overlay marks as VEX status "not affected" are automatically
moved out of scope, with the reason shown. The analyst can manually prune or restore any
entry and can override the VEX decision.

Out-of-scope triplets feed neither individual risk nor cascading propagation. They are
recorded but excluded from all computation.

---

## Input: xBOMGuard (CLX) -> RAP

Integration Matrix row 9. V1 mechanism: file-based (export from xBOMGuard, import into RAP).

Two-tier interface:
1. CycloneDX 1.6 BOM: components, versions, purl (preferred), CPE (where derivable),
   bom-ref (within-BOM only), asset/release context.
2. Prioritised vulnerability/exposure overlay: a CycloneDX VDR/VEX or xBOMGuard JSON
   referencing the same identifiers. Indicative fields: componentRef/bom-ref, assetRef,
   name, version, purl, CPE, CVE, CVSS, EPSS, KEV flag, VEX/applicability status, priority
   score/band, reason codes, recommended action.

The xBOMGuard priority (priority band, reason codes, recommended action) is consumed as
enrichment only: displayed in the UI, used as test-candidate flags and scenario seeds.
It never replaces the RAP's own computed risk score. De-duplication is by CVE + identifier.

---

## Input: Pentesting (ZELUS) -> RAP

Integration Matrix row 10. V1 mechanism: file-based.

Payload (per finding):
```json
{
  "asset_id": "string",
  "cve": "CVE-YYYY-NNNNN",
  "validation_status": "confirmed | pending",
  "severity": "low | medium | high",
  "evidence": "string",
  "timestamp": "ISO-8601",
  "bom_ref": "string (optional, within-BOM only)",
  "cpe": "string (optional)"
}
```

RAP behaviour: for the matching (asset, CVE), set the `confirmed` flag to `confirmed-exploited`
and apply a severity override. The `evidence` string and `timestamp` are stored as provenance.

---

## Input: CTI PolemAIrchOS (ENDO) -> RAP

Integration Matrix row 11. V1 mechanism: REST API. Format: STIX 2.1.

The CTI input feeds a pool of known threats that the RAP merges into its threat catalog.
This enriches the threat side of the assessment; it does not replace or alter the risk
formula.

V1 is built on a sample STIX dataset. The integration flips to live data when ENDO confirms
the exact field mapping. Both sides are marked Validated in the Integration Matrix.

---

## Output: RAP -> TDIR (PRV, internal)

Integration Matrix row 15. Mechanism: REST API (internal). Format: JSON.

RAP computes and owns both individual and cascading risk (Decision D-1). TDIR consumes
the handoff payload and does not recompute risk.

Handoff payload shape (per asset):
```json
{
  "asset_id": "string",
  "criticality": "int 0-4 (max ROLFP value for this asset)",
  "risk": { "C": 0, "I": 0, "A": 0, "max": 0 },
  "cascading_paths": [
    {
      "target": "asset_id",
      "dimension": "A",
      "source": "asset_id",
      "edges": ["hosted-on"],
      "value": 24
    }
  ]
}
```

---

## Output: Risk scenarios (RAP -> CLX Threat Hunting / ZELUS Cyber Range)

Integration Matrix rows 14 and 20. V1 mechanism: file export (manual/file exchange);
optional REST API if agreed.

Scenarios are machine-readable JSON. Each scenario includes: asset refs, threat and MITRE
ATT&CK technique (where known), severity/band, related CVE, and cascading paths.
These are used by the Threat Hunting Workbench (CLX) for hypothesis generation and by
the Cyber Range (ZELUS) for exercise scenario design.

---

## REST API surface

Auth: `X-API-Key` header for machine clients (partners, automated pipelines).
The browser UI uses the user's login session; it does not use a static API key.

```
POST   /assessments
POST   /assessments/{id}/assets:importCycloneDX
POST   /assessments/{id}/overlay:import
POST   /assessments/{id}/pentest:import
POST   /assessments/{id}/vulns:refresh
GET    /assessments/{id}/risk
GET    /assessments/{id}/cascading
POST   /assessments/{id}/overrides
GET    /assessments/{id}/scenarios
GET    /assessments/{id}/handoff
GET    /assessments/{id}/export?format=json|pdf|xlsx|cyclonedx|oscal
GET    /cpe:search?q=
```

---

## Threat catalogs

V1 ships with the following catalogs loaded and active in scoring:
- MAGERIT v3 (55 threats)
- ENISA threat taxonomy
- MITRE ATT&CK for ICS

The following catalogs are added when the required data files are supplied; they are not
V1 blockers and do not affect the scoring engine until loaded:
- NIST SP 800-30 Rev.1 Appendix E (CSV/XLSX with columns: table, event, description;
  CIA flags assigned in-tool).
- BSI elementary threats (CSV/XLSX with columns: id, name, description, plus affects_C /
  affects_I / affects_A if present).

NIST CSF v2.0 and CIS Controls v8 are available as reference catalogs (browsable in the
Catalog screen) but are not wired into risk scoring in any version. A "Reference only"
label marks them in the UI.
