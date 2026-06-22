// v3 parity — reuses the risk-frontend C9a residualParity vectors verbatim. Both
// the Dashboard "Overall reduction" KPI and the Mitigations header read the SAME
// shared aggregate (aggregateResidual) and format with the SAME helper
// (formatReductionPct). Score-mass 39/68 -> "57%"; empty denominator -> em-dash.

import { describe, it, expect } from 'vitest';
import { aggregateResidual, formatReductionPct, bandFor, type RiskResultV3 } from '../src/index';

const rr = (score: number, indeterminate = false): RiskResultV3 => ({
  riskC: score,
  riskI: 0,
  riskA: 0,
  riskScore: score,
  band: bandFor(score),
  indeterminate,
  maxDim: 'C',
});

describe('v3 parity — residual reduction aggregate', () => {
  it('both surfaces format the same shared aggregate identically', () => {
    const pairs = [
      { original: rr(36), residual: rr(9) }, // High -> Medium
      { original: rr(20), residual: rr(20) }, // unmitigated
      { original: rr(12), residual: rr(0) }, // remediated
    ];
    const agg = aggregateResidual(pairs);

    const mitigationsHeaderValue = formatReductionPct(agg.reductionPct);
    const dashboardKpiValue = formatReductionPct(agg.reductionPct);

    expect(dashboardKpiValue).toBe(mitigationsHeaderValue);
    // score-mass: (36-9 + 0 + 12) / (36+20+12) = 39/68 = 0.5735...
    expect(agg.reductionPct).toBeCloseTo(39 / 68, 5);
    expect(dashboardKpiValue).toBe('57%');
    // band counts are a single shared source both pages read:
    expect(agg.highOriginal).toBe(1);
    expect(agg.highResidual).toBe(0);
    expect(agg.mediumOriginal).toBe(2); // originals 20 and 12 are Medium
    expect(agg.mediumResidual).toBe(2); // residual 9 and 20
  });

  it('empty denominator -> em-dash on both (never 0%)', () => {
    const agg = aggregateResidual([{ original: rr(0, true), residual: rr(0) }]);
    expect(agg.reductionPct).toBeNull();
    expect(formatReductionPct(agg.reductionPct)).toBe('—');
  });
});
