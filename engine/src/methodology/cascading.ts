// Cascading-risk propagation (V4, additive). RAW pass (C1a). Risk flows along a
// flat directed dependency graph; each hop attenuates by a per-CIA transmission
// coefficient (tau). For an asset T and dimension d:
//
//   CascadingRisk_d(T) = max over upstream paths P (length >= 1) ending at T of
//                        SourceRisk_d(start(P)) x prod(tau_d over hops in P)
//   Total_d(T)         = min(80, max(IndividualRisk_d(T), CascadingRisk_d(T)))
//
// Pure graph layer: `propagate` knows nothing about triplets — it consumes a
// Map<assetId, sourceRisk>. The methodology-aware reducers (sourceRiskFromTriplets,
// residualSourceRiskFromTriplets) sit on top. The scoring kernel is INVARIANT;
// nothing here changes the Impact x Applicability x Probability x Severity formula.
//
// Algorithm (D3): DFS max-product per dim along OUTGOING edges in declaration
// order, with a per-traversal visited-set on nodes (cycle-safe, NO length cap).
// An edge with effectiveTau === 0 is skipped for that dimension. Values are exact
// floats (no engine rounding). Determinism / tie-break: iterate start nodes by
// assetId ASC and edges in declaration order, REPLACING a node's best only on a
// STRICTLY GREATER value -> the smaller source assetId (then earlier edge) wins
// equal-value ties naturally.

import type { CiaDim } from '../types/threat';
import type { MitigationRecord } from '../types/mitigation';
import type {
  DependencyEdge,
  CascadingPathStep,
  CascadingResult,
} from '../types/cascading';
import type { DerivedTriplet } from './deriveTriplets';
import { residualTripletRisk } from './residual';
import { RISK_SCALE_MAX, TAU_DEFAULTS } from '../constants';

const CIA_DIMS: readonly CiaDim[] = ['C', 'I', 'A'];

/** Effective transmission coefficient for an edge on one dimension:
 *  per-edge override ?? per-type default. */
export function effectiveTau(edge: DependencyEdge, dim: CiaDim): number {
  return edge.tau?.[dim] ?? TAU_DEFAULTS[edge.type][dim];
}

/** Propagate per-dimension source risk over the dependency graph. Returns a
 *  CascadingResult for every node (graph endpoint or source-risk key). */
export function propagate(
  edges: DependencyEdge[],
  sourceRiskByAsset: Map<string, number>,
  dim: CiaDim,
): Map<string, CascadingResult> {
  // Node universe: every edge endpoint + every source-risk key.
  const nodeSet = new Set<string>();
  for (const e of edges) {
    nodeSet.add(e.from);
    nodeSet.add(e.to);
  }
  for (const k of sourceRiskByAsset.keys()) nodeSet.add(k);

  // Outgoing adjacency, preserving edge declaration order.
  const outgoing = new Map<string, DependencyEdge[]>();
  for (const e of edges) {
    const list = outgoing.get(e.from);
    if (list) list.push(e);
    else outgoing.set(e.from, [e]);
  }

  // Best cascading value + winning path per downstream node.
  const bestValue = new Map<string, number>();
  const bestPath = new Map<string, CascadingPathStep[]>();

  // Start each DFS from a source node, iterating assetIds ascending so equal
  // values resolve to the smaller source assetId.
  const starts = [...nodeSet].sort();
  for (const start of starts) {
    const sourceRisk = sourceRiskByAsset.get(start) ?? 0;
    if (sourceRisk === 0) continue; // a 0-risk source can never beat the default 0
    const visited = new Set<string>([start]);

    const walk = (node: string, product: number, path: CascadingPathStep[]) => {
      for (const edge of outgoing.get(node) ?? []) {
        const tau = effectiveTau(edge, dim);
        if (tau === 0) continue; // edge does not transmit this dimension
        if (visited.has(edge.to)) continue; // cycle guard (per-traversal)
        const nextProduct = product * tau;
        const step: CascadingPathStep = { from: edge.from, to: edge.to, type: edge.type, tau };
        const nextPath = [...path, step];
        const candidate = sourceRisk * nextProduct;
        const prev = bestValue.get(edge.to);
        if (prev === undefined || candidate > prev) {
          bestValue.set(edge.to, candidate);
          bestPath.set(edge.to, nextPath);
        }
        visited.add(edge.to);
        walk(edge.to, nextProduct, nextPath);
        visited.delete(edge.to);
      }
    };
    walk(start, 1, []);
  }

  const out = new Map<string, CascadingResult>();
  for (const node of nodeSet) {
    const cascading = bestValue.get(node) ?? 0;
    const individual = sourceRiskByAsset.get(node) ?? 0;
    const total = Math.min(RISK_SCALE_MAX, Math.max(individual, cascading));
    out.set(node, { assetId: node, dim, cascading, total, path: bestPath.get(node) ?? [] });
  }
  return out;
}

/** Convenience: propagate all three CIA dimensions. */
export function propagateAll(
  edges: DependencyEdge[],
  sourceRiskByDim: Record<CiaDim, Map<string, number>>,
): Record<CiaDim, Map<string, CascadingResult>> {
  return {
    C: propagate(edges, sourceRiskByDim.C, 'C'),
    I: propagate(edges, sourceRiskByDim.I, 'I'),
    A: propagate(edges, sourceRiskByDim.A, 'A'),
  };
}

/** Per-asset, per-dim RAW source risk = max of the asset's triplet riskC/riskI/
 *  riskA. Indeterminate triplets carry 0 and so drop out of the max naturally. */
export function sourceRiskFromTriplets(
  triplets: DerivedTriplet[],
): Record<CiaDim, Map<string, number>> {
  const out: Record<CiaDim, Map<string, number>> = {
    C: new Map(),
    I: new Map(),
    A: new Map(),
  };
  for (const t of triplets) {
    const perDim: Record<CiaDim, number> = { C: t.risk.riskC, I: t.risk.riskI, A: t.risk.riskA };
    for (const d of CIA_DIMS) {
      const prev = out[d].get(t.assetId);
      if (prev === undefined || perDim[d] > prev) out[d].set(t.assetId, perDim[d]);
    }
  }
  return out;
}

/** Per-asset, per-dim RESIDUAL source risk = max of the asset's residual triplet
 *  risk (kernel residualTripletRisk; severity-only mitigation). recByTriplet
 *  supplies each triplet's mitigation record (caller-resolved; engine stays pure).
 *  Remediated/indeterminate triplets carry 0 and drop out of the max (per D5). */
export function residualSourceRiskFromTriplets(
  triplets: DerivedTriplet[],
  recByTriplet: (t: DerivedTriplet) => MitigationRecord | undefined,
): Record<CiaDim, Map<string, number>> {
  const out: Record<CiaDim, Map<string, number>> = {
    C: new Map(),
    I: new Map(),
    A: new Map(),
  };
  for (const t of triplets) {
    const r = residualTripletRisk(t, recByTriplet(t));
    const perDim: Record<CiaDim, number> = { C: r.riskC, I: r.riskI, A: r.riskA };
    for (const d of CIA_DIMS) {
      const prev = out[d].get(t.assetId);
      if (prev === undefined || perDim[d] > prev) out[d].set(t.assetId, perDim[d]);
    }
  }
  return out;
}

/** One-call convenience: reduce triplets to per-CIA source risk, then propagate
 *  over the dependency graph. Omit recByTriplet for the RAW cascade; pass it for
 *  the RESIDUAL cascade. */
export function cascadeFromTriplets(
  edges: DependencyEdge[],
  triplets: DerivedTriplet[],
  recByTriplet?: (t: DerivedTriplet) => MitigationRecord | undefined,
): Record<CiaDim, Map<string, CascadingResult>> {
  const sourceRiskByDim = recByTriplet
    ? residualSourceRiskFromTriplets(triplets, recByTriplet)
    : sourceRiskFromTriplets(triplets);
  return propagateAll(edges, sourceRiskByDim);
}
