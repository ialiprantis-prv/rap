// Locks the v3.1 risk invariant: threat-CIA-only applicability, max(C,I,A),
// bands {9,30,80}, and the INDETERMINATE state for unset severity (spec §15.4).

import { describe, it, expect } from 'vitest';
import { computeRiskV3 } from '../src/index';

describe('computeRiskV3 — v3.1 invariant', () => {
  it('max product: A-applicable, Impact_A=4, Prob=4, Sev=5 -> 80 / high', () => {
    const r = computeRiskV3({
      threatCia: { c: false, i: false, a: true },
      assetImpact: { c: 0, i: 0, a: 4 },
      probability: 4,
      severity: 5,
    });
    expect(r.riskA).toBe(80);
    expect(r.riskScore).toBe(80);
    expect(r.band).toBe('high');
    expect(r.maxDim).toBe('A');
    expect(r.indeterminate).toBe(false);
  });

  it('threat-CIA-only: I-only threat ignores a C-column impact (riskC=0)', () => {
    const r = computeRiskV3({
      threatCia: { c: false, i: true, a: false },
      assetImpact: { c: 4, i: 0, a: 0 },
      probability: 4,
      severity: 5,
    });
    expect(r.riskC).toBe(0); // C not applicable to the threat
    expect(r.riskScore).toBe(0); // I-impact is 0
  });

  it('unset severity -> indeterminate (score 0, never a band)', () => {
    const r = computeRiskV3({
      threatCia: { c: true, i: true, a: true },
      assetImpact: { c: 4, i: 4, a: 4 },
      probability: 4,
      severity: undefined,
    });
    expect(r.indeterminate).toBe(true);
    expect(r.riskScore).toBe(0);
  });
});
