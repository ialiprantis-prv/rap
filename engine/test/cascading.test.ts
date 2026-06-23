// Cascading-layer invariants (C1a, raw pass). Locks: exact-float determinism,
// the source-assetId tie-break, cycle-safety, per-dimension tau (override drops
// only its dim), self-exclusion, diamond max-product path selection, the 80
// clamp, the triplet source-risk reducer (per-asset max; indeterminate -> 0),
// and the residual reducer stub.

import { describe, it, expect } from 'vitest';
import {
  propagate,
  propagateAll,
  effectiveTau,
  sourceRiskFromTriplets,
  residualSourceRiskFromTriplets,
  type DependencyEdge,
  type DerivedTriplet,
} from '../src/index';

/** Minimal DerivedTriplet stub — only the fields the source-risk reducer reads. */
function triplet(assetId: string, riskC: number, riskI: number, riskA: number, indeterminate = false): DerivedTriplet {
  return {
    assetId,
    risk: { riskC, riskI, riskA, riskScore: Math.max(riskC, riskI, riskA), band: 'low', indeterminate, maxDim: 'C' },
  } as unknown as DerivedTriplet;
}

describe('effectiveTau', () => {
  it('uses the per-edge override when present, else the type default', () => {
    const e: DependencyEdge = { from: 'a', to: 'b', type: 'hosted-on', tau: { A: 0.5 } };
    expect(effectiveTau(e, 'A')).toBe(0.5); // override
    expect(effectiveTau(e, 'C')).toBe(0.3); // default hosted-on C
  });
});

describe('propagate — invariants', () => {
  it('exact-float determinism: 16 x 0.5 x 0.5 = 4, stable across calls', () => {
    const src = new Map([['a', 16]]);
    const edges: DependencyEdge[] = [
      { from: 'a', to: 'b', type: 'depends-on' }, // tau_A 0.5
      { from: 'b', to: 'c', type: 'depends-on' },
    ];
    const r1 = propagate(edges, src, 'A');
    const r2 = propagate(edges, src, 'A');
    expect(r1.get('c')!.cascading).toBe(4);
    expect(r1.get('c')!.cascading).toBe(r2.get('c')!.cascading);
  });

  it('tie-break: equal-value paths resolve to the smaller source assetId', () => {
    const src = new Map([['a', 10], ['b', 10]]);
    const edges: DependencyEdge[] = [
      { from: 'b', to: 'z', type: 'depends-on' }, // declared first, but b > a
      { from: 'a', to: 'z', type: 'depends-on' },
    ];
    const z = propagate(edges, src, 'A').get('z')!;
    expect(z.cascading).toBe(5);
    expect(z.path[0].from).toBe('a'); // smaller source assetId wins the tie
  });

  it('cycle A<->B terminates and yields a finite value', () => {
    const src = new Map([['a', 10]]);
    const edges: DependencyEdge[] = [
      { from: 'a', to: 'b', type: 'depends-on' },
      { from: 'b', to: 'a', type: 'depends-on' },
    ];
    const r = propagate(edges, src, 'A');
    expect(r.get('b')!.cascading).toBe(5); // a -> b
    expect(r.get('a')!.cascading).toBe(0); // a -> b -> a blocked by visited-set
    expect(Number.isFinite(r.get('b')!.cascading)).toBe(true);
  });

  it('tau override {A:0} drops only A; C and I still flow via defaults', () => {
    const src = { C: new Map([['a', 10]]), I: new Map([['a', 10]]), A: new Map([['a', 10]]) };
    const edges: DependencyEdge[] = [{ from: 'a', to: 'b', type: 'hosted-on', tau: { A: 0 } }];
    const all = propagateAll(edges, src);
    expect(all.A.get('b')!.cascading).toBe(0); // A dropped
    expect(all.C.get('b')!.cascading).toBeCloseTo(3, 10); // 10 x 0.3
    expect(all.I.get('b')!.cascading).toBeCloseTo(4, 10); // 10 x 0.4
  });

  it('self-exclusion: no edges -> cascading 0, total = individual', () => {
    const src = new Map([['a', 30]]);
    const a = propagate([], src, 'A').get('a')!;
    expect(a.cascading).toBe(0);
    expect(a.total).toBe(30);
    expect(a.path).toEqual([]);
  });

  it('diamond: picks and records the max-product path', () => {
    const src = new Map([['a', 20]]);
    const edges: DependencyEdge[] = [
      { from: 'a', to: 'hi', type: 'depends-on', tau: { A: 0.9 } },
      { from: 'a', to: 'lo', type: 'depends-on', tau: { A: 0.5 } },
      { from: 'hi', to: 'd', type: 'depends-on', tau: { A: 0.9 } },
      { from: 'lo', to: 'd', type: 'depends-on', tau: { A: 0.5 } },
    ];
    const d = propagate(edges, src, 'A').get('d')!;
    expect(d.cascading).toBeCloseTo(16.2, 10); // 20 x 0.9 x 0.9
    expect(d.path.map((s) => s.to)).toEqual(['hi', 'd']);
  });

  it('Total clamps at 80', () => {
    const src = new Map([['a', 100]]);
    const edges: DependencyEdge[] = [{ from: 'a', to: 'b', type: 'depends-on', tau: { A: 1 } }];
    const r = propagate(edges, src, 'A');
    expect(r.get('a')!.total).toBe(80); // individual 100 clamped
    expect(r.get('b')!.total).toBe(80); // cascading 100 clamped
  });
});

describe('sourceRiskFromTriplets', () => {
  it('takes the per-asset, per-dim max', () => {
    const ts = [triplet('a', 5, 0, 0), triplet('a', 2, 9, 1), triplet('b', 0, 0, 7)];
    const src = sourceRiskFromTriplets(ts);
    expect(src.C.get('a')).toBe(5);
    expect(src.I.get('a')).toBe(9);
    expect(src.A.get('a')).toBe(1);
    expect(src.A.get('b')).toBe(7);
  });

  it('indeterminate-only asset yields 0 (excluded from the max)', () => {
    const ts = [triplet('x', 0, 0, 0, true)];
    const src = sourceRiskFromTriplets(ts);
    expect(src.C.get('x')).toBe(0);
    // a real triplet on the same asset still wins the max
    const mixed = sourceRiskFromTriplets([triplet('y', 0, 0, 0, true), triplet('y', 6, 0, 0)]);
    expect(mixed.C.get('y')).toBe(6);
  });
});

describe('residualSourceRiskFromTriplets', () => {
  it('is stubbed for C1b', () => {
    expect(() => residualSourceRiskFromTriplets([], () => undefined)).toThrow('C1b');
  });
});
