// Engine kernel subset — mitigation model. Ported from risk-frontend
// src/types/mitigationV3.ts. A mitigation attaches to a vuln INSTANCE
// (assetId, cveId) and acts ONLY on the Severity factor (the methodology kernel
// is invariant):
//   - remediate: the CVE is fixed -> residual severity 0. Dominates everything.
//   - mitigate:  D3FEND countermeasures reduce severity, STRONGEST-ONLY
//                (residual = effective - max|effectiveness|), never additive.

/** The seven D3FEND defensive tactics. */
export type D3fendTactic =
  | 'Model'
  | 'Harden'
  | 'Detect'
  | 'Isolate'
  | 'Deceive'
  | 'Evict'
  | 'Restore';

/** A D3FEND countermeasure applied to a vuln instance. */
export interface AppliedCountermeasure {
  /** D3FEND technique id, e.g. "D3-VI". */
  techniqueId: string;
  tacticId: D3fendTactic;
  /** PRIVACT-defined default effectiveness for the tactic (<= 0). */
  effectivenessDefault: number;
  /** Analyst override, integer in [-5, 0]. undefined => use the default. */
  effectivenessOverride?: number;
}

/** The "fix applied" mechanism — presence drives residual severity to 0. */
export interface RemediateState {
  fixedVersion?: string;
  note?: string;
}

/** One persisted mitigation record, keyed (within a project) by asset + CVE. */
export interface MitigationRecord {
  assetId: string;
  cveId: string;
  /** Present iff the CVE instance is marked remediated. */
  remediate?: RemediateState;
  /** Applied D3FEND countermeasures (mitigate mechanism). */
  countermeasures: AppliedCountermeasure[];
}

/** Stable key for a mitigation record within a project. */
export const mitigationKey = (assetId: string, cveId: string) => `${assetId}|${cveId}`;
