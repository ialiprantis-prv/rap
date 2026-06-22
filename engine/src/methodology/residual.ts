// Residual risk. Ported verbatim from risk-frontend src/lib/residualRiskV3.ts.
// Mitigation acts ONLY on the Severity factor; the methodology kernel (Impact,
// ThreatApplicability, Probability, scales, bands) is INVARIANT. We recompute the
// v3.1 formula with severity replaced by the residual severity, then derive
// per-triplet reduction% and project aggregates.
//
//   residualSeverity = remediated ? 0 : max(0, effectiveSeverity - max|effect|)
//   residualRisk_d   = Impact_d x ThreatApplicability_d x Probability x residualSeverity
//   residualScore    = max(C, I, A); same bands 9 / 30 / 80.

import { computeRiskV3, type RiskResultV3 } from './risk';
import { strongestMagnitude } from './effectiveness';
import type { DerivedTriplet } from './deriveTriplets';
import type { MitigationRecord } from '../types/mitigation';

/** Residual severity for a vuln instance. `undefined` (indeterminate) stays
 *  undefined unless remediation drives it to a definite 0. */
export function residualSeverity(
  effectiveSeverity: number | undefined,
  rec: MitigationRecord | undefined,
): number | undefined {
  if (rec?.remediate) return 0;
  if (effectiveSeverity === undefined) return undefined;
  return Math.max(0, effectiveSeverity - strongestMagnitude(rec?.countermeasures ?? []));
}

/** Residual risk for one triplet under its instance's mitigation record. */
export function residualTripletRisk(
  t: DerivedTriplet,
  rec: MitigationRecord | undefined,
): RiskResultV3 {
  return computeRiskV3({
    threatCia: t.threatCia,
    assetImpact: t.impact,
    probability: t.probability,
    severity: residualSeverity(t.severity, rec),
  });
}

/** Per-triplet reduction fraction (0-1), or null when there is no real original
 *  risk to reduce (indeterminate severity, or original score 0). */
export function tripletReduction(original: RiskResultV3, residual: RiskResultV3): number | null {
  if (original.indeterminate || original.riskScore <= 0) return null;
  return (original.riskScore - residual.riskScore) / original.riskScore;
}

/** Canonical display of a score-mass reduction fraction. Shared by the
 *  Mitigations header strip and the Dashboard KPI so the two always agree
 *  (null -> em-dash, never a misleading 0%). */
export function formatReductionPct(pct: number | null): string {
  return pct === null ? '—' : `${Math.round(pct * 100)}%`;
}

export interface ResidualAggregate {
  /** Score-mass reduction fraction (0-1), or null when the denominator is empty
   *  (no in-scope triplet with a real original risk) -> render an em-dash. */
  reductionPct: number | null;
  sumOriginal: number;
  sumResidual: number;
  highOriginal: number;
  highResidual: number;
  mediumOriginal: number;
  mediumResidual: number;
  lowOriginal: number;
  lowResidual: number;
}

/** Project aggregate over in-scope triplets. Score-mass ratio excludes
 *  indeterminate and zero-original triplets from the denominator; band-shift
 *  counts likewise ignore them. Always recomputed from engine output. */
export function aggregateResidual(
  pairs: readonly { original: RiskResultV3; residual: RiskResultV3 }[],
): ResidualAggregate {
  let sumOriginal = 0;
  let sumResidual = 0;
  let highOriginal = 0;
  let highResidual = 0;
  let mediumOriginal = 0;
  let mediumResidual = 0;
  let lowOriginal = 0;
  let lowResidual = 0;
  for (const { original, residual } of pairs) {
    if (original.indeterminate || original.riskScore <= 0) continue;
    sumOriginal += original.riskScore;
    sumResidual += residual.riskScore;
    if (original.band === 'high') highOriginal++;
    else if (original.band === 'medium') mediumOriginal++;
    else lowOriginal++;
    if (residual.band === 'high') highResidual++;
    else if (residual.band === 'medium') mediumResidual++;
    else lowResidual++;
  }
  return {
    reductionPct: sumOriginal > 0 ? (sumOriginal - sumResidual) / sumOriginal : null,
    sumOriginal,
    sumResidual,
    highOriginal,
    highResidual,
    mediumOriginal,
    mediumResidual,
    lowOriginal,
    lowResidual,
  };
}
