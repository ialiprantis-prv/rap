// Residual cascading: same propagation as raw, source risk from the kernel's
// residual triplet risk. Mirrors §8.6 with a Harden (-2 severity) countermeasure
// on Edge Node, so residual < raw. Exercises the cascadeFromTriplets helper.

import { describe, it, expect } from 'vitest';
import {
  cascadeFromTriplets,
  computeRiskV3,
  type DependencyEdge,
  type DerivedTriplet,
  type MitigationRecord,
} from '../src/index';

const threatCia = { c: false, i: false, a: true };
const impact = { c: 0, i: 0, a: 3 };

// Edge Node: raw Risk_A = 1 x 3 x 2 x 5 = 30 (the §8.6 source).
const edgeNode = {
  assetId: 'edge-node',
  threatCia,
  impact,
  probability: 2,
  severity: 5,
  risk: computeRiskV3({ threatCia, assetImpact: impact, probability: 2, severity: 5 }),
} as unknown as DerivedTriplet;

const edges: DependencyEdge[] = [{ from: 'edge-node', to: 'data-manager', type: 'hosted-on' }];

// Harden (-2) on the Edge Node instance -> residual severity 5 - 2 = 3.
const harden: MitigationRecord = {
  assetId: 'edge-node',
  cveId: 'CVE-X',
  countermeasures: [{ techniqueId: 'D3-HARDEN', tacticId: 'Harden', effectivenessDefault: -2 }],
};

describe('residual cascading via cascadeFromTriplets', () => {
  it('RAW (no recByTriplet): Edge Node A=30 cascades to 24', () => {
    const r = cascadeFromTriplets(edges, [edgeNode]);
    expect(r.A.get('edge-node')!.total).toBe(30);
    expect(r.A.get('data-manager')!.cascading).toBe(24);
    expect(r.A.get('data-manager')!.total).toBe(24);
  });

  it('RESIDUAL (Harden -2): source drops to 18, cascade to 14.4', () => {
    const r = cascadeFromTriplets(edges, [edgeNode], (t) => (t.assetId === 'edge-node' ? harden : undefined));
    expect(r.A.get('edge-node')!.total).toBe(18); // 1 x 3 x 2 x (5-2)
    expect(r.A.get('data-manager')!.cascading).toBeCloseTo(14.4, 10); // 18 x 0.8
    expect(r.A.get('data-manager')!.total).toBeCloseTo(14.4, 10);
  });
});
