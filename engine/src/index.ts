// @rap/engine — public surface of the PRIVACT methodology kernel. The ONLY
// implementation of the formula; server and browser both import from here so
// there is zero methodology drift. Ported verbatim from risk-frontend v3.

// --- constants (single source of truth for the numeric kernel) ---
export { RISK_SCALE_MAX, BAND_THRESHOLDS, TACTIC_EFFECT, PROB_BASELINE, ZONE_EXPOSURE } from './constants';

// --- types ---
export type { CiaDim, CvssSeverity } from './types/threat';
export type { TripletBand } from './types/triplet';
export type { CiaFlags, ThreatOrigin, CatalogThreat, ProjectThreat } from './types/catalog';
export type {
  RiskScore,
  RolfpRow,
  Rolfp,
  CycloneDxComponentType,
  AssetTypeId,
  PrivactExt,
  Asset,
} from './types/asset';
export type { VulnSourceId, CvssSummary, VulnRecord } from './types/vuln';
export type { D3fendTactic, AppliedCountermeasure, RemediateState, MitigationRecord } from './types/mitigation';
export { mitigationKey } from './types/mitigation';

// --- methodology ---
export { emptyRolfp, maxPerCia } from './methodology/impact';
export { defaultSeverityFromCvss, cweUrl } from './methodology/severity';
export { suggestProbability } from './methodology/probability';
export { bandFor, computeRiskV3 } from './methodology/risk';
export type { RiskResultV3 } from './methodology/risk';
export { clampOverride, effectiveEffect, strongestMagnitude } from './methodology/effectiveness';
export {
  residualSeverity,
  residualTripletRisk,
  tripletReduction,
  formatReductionPct,
  aggregateResidual,
} from './methodology/residual';
export type { ResidualAggregate } from './methodology/residual';
export { deriveTriplets, effectiveSeverity } from './methodology/deriveTriplets';
export type {
  DerivedTriplet,
  DeriveTripletsParams,
  ProbabilitySource,
  SeveritySource,
} from './methodology/deriveTriplets';
