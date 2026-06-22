// v3.1 risk math. Ported verbatim from risk-frontend src/lib/riskComputation.ts
// (the v3 live model — `computeRiskV3` + `bandFor`). The v3.1 invariant uses
// THREAT-only applicability (the threat's CIA flags) and adds an INDETERMINATE
// state for an unset severity: that is NOT a real 0. Max product = 1 x 4 x 4 x 5
// = 80.
//   Impact_d              = max over ROLFP rows of asset.rolfp[row][d]  (0-4)
//   ThreatApplicability_d = threat.ciaFlags[d]                          (0/1)
//   Risk_d = Applicability_d x Impact_d x Probability x Severity
//   RiskScore = max(Risk_C, Risk_I, Risk_A)            // range 0-80
//   Band: Low 0-8 / Medium 9-29 / High 30-80
//
// (The v2 threat-INTERSECT-vuln applicability functions — computeRiskDim,
// computeTripletRisk, applicabilityFor — are NOT part of the v3 kernel and are
// intentionally not ported.)

import type { CiaDim } from '../types/threat';
import type { TripletBand } from '../types/triplet';
import { BAND_THRESHOLDS } from '../constants';

export { BAND_THRESHOLDS };

export function bandFor(score: number): TripletBand {
  if (score >= BAND_THRESHOLDS.highMin) return 'high';
  if (score >= BAND_THRESHOLDS.mediumMin) return 'medium';
  return 'low';
}

export interface RiskResultV3 {
  riskC: number;
  riskI: number;
  riskA: number;
  riskScore: number;
  band: TripletBand;
  /** Severity unset (no CVSS-derived default, no override) -> risk is unknown,
   *  not 0. riskScore is 0 but callers must show "indeterminate", never a band. */
  indeterminate: boolean;
  /** The dimension that produced the max (for the detail-popup highlight). */
  maxDim: CiaDim;
}

export function computeRiskV3(input: {
  threatCia: { c: boolean; i: boolean; a: boolean };
  assetImpact: { c: number; i: number; a: number };
  probability: number;
  severity: number | undefined;
}): RiskResultV3 {
  const indeterminate = input.severity === undefined;
  const sev = input.severity ?? 0;
  const dim = (applicable: boolean, impact: number) =>
    (applicable ? 1 : 0) * impact * input.probability * sev;
  const riskC = dim(input.threatCia.c, input.assetImpact.c);
  const riskI = dim(input.threatCia.i, input.assetImpact.i);
  const riskA = dim(input.threatCia.a, input.assetImpact.a);
  const riskScore = Math.max(riskC, riskI, riskA);
  const maxDim: CiaDim = riskC === riskScore ? 'C' : riskI === riskScore ? 'I' : 'A';
  return { riskC, riskI, riskA, riskScore, band: bandFor(riskScore), indeterminate, maxDim };
}
