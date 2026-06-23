// Acceptance: the cascading-risk.md §8.6 worked example. Host "Edge Node"
// (Risk_A = 30) hosts "Data Manager" (IndividualRisk_A = 10) over a hosted-on
// edge (tau_A = 0.8). Expected: CascadingRisk_A(Data Manager) = 30 x 0.8 = 24,
// Total_A = min(80, max(10, 24)) = 24, with the single hop recorded as the path.

import { describe, it, expect } from 'vitest';
import { propagate, type DependencyEdge } from '../src/index';

describe('cascading acceptance — §8.6 (Edge Node -> Data Manager, tau_A=0.8)', () => {
  const src = new Map<string, number>([
    ['edge-node', 30],
    ['data-manager', 10],
  ]);
  const edges: DependencyEdge[] = [{ from: 'edge-node', to: 'data-manager', type: 'hosted-on' }];

  it('Data Manager cascades to 24', () => {
    const r = propagate(edges, src, 'A');
    const dm = r.get('data-manager')!;
    expect(dm.cascading).toBe(24);
    expect(dm.total).toBe(24);
    expect(dm.path).toEqual([
      { from: 'edge-node', to: 'data-manager', type: 'hosted-on', tau: 0.8 },
    ]);
  });

  it('Edge Node has no upstream (cascading 0, total = individual 30)', () => {
    const r = propagate(edges, src, 'A');
    const en = r.get('edge-node')!;
    expect(en.cascading).toBe(0);
    expect(en.total).toBe(30);
    expect(en.path).toEqual([]);
  });
});
