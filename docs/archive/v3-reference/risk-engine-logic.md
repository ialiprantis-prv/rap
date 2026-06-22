# Risk Engine Logic (v2)

The end-to-end scoring pipeline. PRIVACT methodology — formula, scales, bands, ROLFP — is **unchanged** from v1; v2 added two override layers at the inputs (severity, applicability) without touching the formula itself.

## Phase 1 — Scope (user-driven)

User defines:

- Project metadata (name, scope, description).
- CIA priorities (Confidentiality, Integrity, Availability — high-level weights on the 0-4 scale).
- Threat Actor Profile (v2 commit 09 — 4 ENISA categories: Cybercriminals, State-Sponsored, Hacktivists, Insider Threats — selectable to scope the threat catalog by motivation).
- Assets — each carries a CycloneDX 1.6 `type` (e.g. `application`, `container`, `device`, `data`) plus a PRIVACT `legacyCategory` (Database, Application/API, Container, Container Network, Hardware, OS, TCP/IP) for engine matching.
- Services — same data shape as Assets, separate collection (CycloneDX semantic split, v2 commit 03).
- Links — asset-to-asset relationships, undirected, untyped.

Each asset/service gets a **15-cell ROLFP matrix** (impact scoring):

- Rows: Reputation, Operational, Legal, Financial, Personal (5 dimensions).
- Columns: Confidentiality, Integrity, Availability (3 dimensions of impact).
- Each cell: 0-4 integer (`RiskScore` union in `src/lib/scale.ts`).
- The entity's effective C/I/A impact = `max` across rows for each column (`src/lib/rolfp.ts` `maxPerCia`).

## Phase 2 — Modeling + Applicability Review

Engine matches the asset+service list against pre-baked catalogs:

- 55 threats (sources: MAGERIT / EBIOS / ENISA / OWASP — case-study scale; real catalog is dynamic, see `docs/backend-integration-playbook.md` §0.4).
- 96 vulnerabilities (sources: MONARC / OWASP — same caveat).

### Applicability resolution — two-layer model (v2 commit 14)

The single source of truth is `src/lib/applicabilityResolver.ts` → `resolveApplicability(input)`. For a given `(assetId, type: 'threat'|'vuln', itemId)`:

1. **Category-based default** (inherited from v1): `defaultEffective = item.assetCategories.includes(asset.legacyCategory)`.
2. **Per-asset override layer** (v2 commit 14): if `(assetId, type, itemId)` has an `ApplicabilityOverride { state: 'applicable' | 'not-applicable' }` stored, the override **always wins** over the default.

Returns: `{ effective, source: 'default' | 'override', override?, defaultEffective }`.

The triplet generator calls this for both threat-side and vuln-side checks. The Per-Asset Applicability UI consumes `source` for the Inherited / Overridden badge.

User reviews the filtered threats and vulnerabilities in Phase 2 (Screen 6) before triplet generation; explicit per-asset overrides land in the new third sub-tab.

## Phase 3 — Triplet Generation

For each `(asset, threat, vuln)` where:

- `resolveApplicability(asset, 'threat', threat.threatId)` is `effective: true` (after override layer), AND
- `resolveApplicability(asset, 'vuln', vuln.vulnId)` is `effective: true` (after override layer),

a triplet is generated with:

- `applicability = 1` (binary, since the resolver said "effective").
- `assetImpact = maxPerCia(asset.rolfp)` → 0-4 per CIA dimension.
- `threatProbability = threat.defaultProbability` (0-4).
- `vulnSeverity` (0-5) — resolved as below.

### Severity resolution — two-source model (v2 commit 13)

1. **Catalog-derived** (inherited from v2 commit 01): `vuln.cvss.baseScore` → `legacySeverityFromCvss` → 0-5 PRIVACT severity.
2. **Environmental override** (v2 commit 13): `triplet.cvssEnvironmentalOverride.derivedFormulaInput` when `override.enabled === true`.

The triplet generator's `effectiveSeverity` swaps `vuln.defaultSeverity → override.derivedFormulaInput` in the formula. The `Triplet.vulnSeverity` field keeps the **catalog value** (so the UI can show "Base vs Environmental" side-by-side); the `Triplet.riskScore` already reflects the override.

### Risk formula (UNCHANGED from v1)

Per CIA dimension:

```
Risk_dim = applicability × assetImpact_dim × threatProbability × effectiveSeverity
```

Aggregate:

```
riskScore = max(Risk_C, Risk_I, Risk_A)   // 0-80
```

Bands:

- **Low:** 0-8.
- **Medium:** 9-29.
- **High:** 30-80.

Implementation: `src/lib/riskComputation.ts` `computeTripletRisk()`; per-dimension fields land on `Triplet` as `riskC` / `riskI` / `riskA`; `band` is derived via `getRiskBand`.

## Phase 4 — Mitigation Planning (user-driven)

For each triplet, the user picks:

- **Controls** from NIST CSF v2.0 + CIS Controls v8 (commit 10). A control belongs to exactly ONE framework (NIST OR CIS, never both).
- **Countermeasures** from MITRE D3FEND (commit 10). D3FEND-only.

### Residual formula — multiplicative single-pool

Implementation: `src/lib/residualComputation.ts`.

```
residual = original × Π(1 - r_i)
```

- Controls + countermeasures pool into the SAME product (single pool, not separate stages).
- `r_i` is the per-entry default reduction percentage (catalog-global; per-(entry, asset-category) tuning is deferred — see `docs/open-questions.md`).
- Score-level (uniform across C/I/A), not per-dimension.
- Floored at 0; rounded to nearest integer.

Reduction applies live as the user toggles selections (optimistic UI, debounced server call). The dashboard surfaces `mitigatedCount`, `totalReductionPercent`, `highResidualCount` aggregates.

> **Backend contract:** this is the assumed formula. `docs/open-questions.md` Phase 4a flags it for backend confirmation — must match or residuals will diverge.

## Phase 4c — Output

Structured requirements list grouped by NIST CSF function (Identify / Protect / Detect / Respond / Recover). Five export formats: PDF (formal), XLSX (analyst), JSON (machine), CycloneDX 1.6 (asset BOM), OSCAL 1.1.2 (assessment results). Standards data emits via the `x-privact:*` property namespace (e.g. `x-privact:applicability-overrides`, `x-privact:env-score`) so methodology data round-trips through the standard format adapters.

## Methodology preservation guarantee

The formula (`Risk = Applicability × Impact × Probability × Severity`), the 0-4 / 0-4 / 0-5 / 0-80 scales, the ROLFP matrix, the band thresholds, and the phase sequence are **stable contract** between v1 and v2 — and forward. Standards integration adds vocabulary, hierarchy navigation, import / export interop, and the two override layers (severity, applicability) — never replaces the core. See `CLAUDE.md` "METHODOLOGY PRESERVATION" for the non-negotiable framing.
