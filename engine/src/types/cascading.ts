// Cascading-risk layer types (V4, additive). A flat dependency graph over assets
// plus the per-(asset, dim) propagation result. The engine stays GRAPH-PURE: it
// consumes a unified DependencyEdge[]; containment/parent_ref derivation is a
// backend concern (see docs/cascading-risk.md, C1 decision D1). The scoring
// kernel (Impact x ThreatApplicability x Probability x Severity) is INVARIANT;
// cascading does not change the triplet formula.

import type { CiaDim } from './threat';

/** Canonical dependency-edge kind. "runs-on" is an alias that collapses to
 *  'hosted-on' upstream of the engine. */
export type EdgeType = 'hosted-on' | 'reads-data-from' | 'authenticates-via' | 'depends-on';

/** Directed edge: `from` hosts/supports `to`; risk flows from -> to. Optional
 *  per-dimension tau overrides the TAU_DEFAULTS for that edge/dim. */
export interface DependencyEdge {
  from: string;
  to: string;
  type: EdgeType;
  tau?: Partial<Record<CiaDim, number>>;
}

/** One hop of a winning contributing path; `tau` is the EFFECTIVE coefficient
 *  used for this dimension (override ?? default). */
export interface CascadingPathStep {
  from: string;
  to: string;
  type: EdgeType;
  tau: number;
}

/** Propagation result for one asset on one CIA dimension (exact floats; display
 *  rounding is the frontend's job). */
export interface CascadingResult {
  assetId: string;
  dim: CiaDim;
  /** Best upstream-attenuated source risk (0 if no upstream path). */
  cascading: number;
  /** min(80, max(individual, cascading)). */
  total: number;
  /** Winning contributing path (empty if cascading === 0). */
  path: CascadingPathStep[];
}
