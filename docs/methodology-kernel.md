# PRIVACT Methodology Kernel

**This kernel is INVARIANT. It must not drift between the engine package, the backend,
the frontend display, or any export. If a request appears to require changing the formula,
scales, bands, ROLFP shape, or phase sequence, push back before proceeding.**

The kernel is carried unchanged from v3. V4 adds the cascading layer (see `cascading-risk.md`)
on top of this kernel; the cascading layer does not modify anything defined here.

---

## Risk formula (per CIA dimension)

For each triplet (asset x threat x CVE) and each dimension d in {C, I, A}:

```
Risk_d = Impact_d x ThreatApplicability_d x Probability x Severity
```

Max Risk = max(Risk_C, Risk_I, Risk_A), range 0-80.
Record which dimension produced the max.

---

## Factor definitions

### Impact_d

Impact_d = max over the five ROLFP rows of the d-column value.

ROLFP is a 5x3 matrix. Rows: Reputation, Operational, Legal, Financial, Personal.
Columns: C, I, A. Each cell is an integer 0-4 set by the analyst.
Impact_d is therefore in the range 0-4.

### ThreatApplicability_d

The threat's CIA flag for dimension d: 0 or 1.
This is threat-CIA-only (the v3.1 fidelity correction). The threat flag alone determines
applicability per dimension; there is no intersection with a vulnerability CIA flag.

### Probability

Effective probability = analyst override, or if none, the suggestion.
Range: integer 0-4.
Keyed per (threat x asset type x zone).

Suggestion rules:
- Baseline: 2.
- For DELIBERATE threats, add a Purdue/ISA-95 zone modifier (then clamp 0-4):
  - L5 Internet/Cloud: +1
  - L4 Enterprise: +1
  - L3.5 DMZ: 0
  - L3 Operations: 0
  - L2 Supervisory: -1
  - L1 Basic Control: -1
  - L0 Process: -1
- For non-deliberate threats (accidental, natural, industrial): flat baseline 2 regardless of zone.
- Custom (non-Purdue) zones: neutral modifier (0).

### Severity

Effective severity = analyst override, or if none, derived from the CVE's CVSS base score.

Derivation: `severity = min(5, max(0, round(cvss_base / 2)))`.

If cvss_base is undefined or NaN, severity is INDETERMINATE. An indeterminate severity means
the triplet is INDETERMINATE: risk is unknown, not zero, and no band is shown. This is the
locked "C4" rule. The older banded CVSS-to-severity lookup table (a v2 seed-only path) is
not used.

Range when defined: integer 0-5.

---

## Risk bands

| Band | Range |
|---|---|
| Low | 0-8 |
| Medium | 9-29 |
| High | 30-80 |

Thresholds: mediumMin = 9, highMin = 30, max = 80.

Indeterminate triplets have no band.

---

## Residual risk

Mitigation acts on the Severity factor only. This is a kernel invariant.

```
residualSeverity = remediated ? 0 : max(0, effectiveSeverity - strongestDelta)
Residual_d = Impact_d x ThreatApplicability_d x Probability x residualSeverity
```

strongestDelta is the single strongest applicable D3FEND tactic delta. Deltas are never
additive or stacked.

D3FEND tactic deltas (PRIVACT modelling defaults, in severity points):

| Tactic | Delta |
|---|---|
| Isolate | -3 |
| Harden | -2 |
| Deceive | -1 |
| Detect | -1 |
| Evict | 0 |
| Restore | 0 |
| Model | 0 |

Analyst override: clamped to integer [-5, 0].

Remediation (marking a vulnerability fully remediated) forces residualSeverity = 0,
regardless of whether severity was previously indeterminate, yielding a definite 0.
Otherwise, an indeterminate severity stays indeterminate in the residual.

---

## Triplet identity

Triplet = one (asset x threat x CVE).

Deterministic ID format: `TR-{projectId}-{assetId}-{threatId}-{cveId}`.
Identical inputs always yield the same ID across recomputes.

Service/CPE-less assets (assets that carry neither CPE nor purl) contribute no triplets
because there is no CVE match path.

---

## Default | Override philosophy

Every automatically-derived value (severity, probability, effectiveness, transmission
coefficient) is a pre-fill the analyst can override. The analyst owns every number.
Provenance is recorded for each value: source, whether it is the default or an analyst
override, and timestamp.

---

## Phases

The phase sequence is permanent and must not be renamed or reordered:

Setup -> Assets -> Review -> Triplets -> Mitigations -> Dashboard -> Export

Scope is a UI step between Review and Triplets (not a separate phase). Catalog is a
reference screen, not a phase. V4 adds a "Dependencies and Cascading" screen after
Mitigations; it is a new screen within the existing phase structure, not a new phase.
