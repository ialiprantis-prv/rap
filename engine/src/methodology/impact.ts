// ROLFP impact helpers. Ported verbatim from risk-frontend src/lib/rolfp.ts.
// `maxPerCia` collapses the 15-cell matrix to the per-CIA impact (max over the
// five ROLFP rows) that the risk formula consumes; `emptyRolfp` is the zeroed
// factory.

import type { Rolfp, RiskScore } from '../types/asset';

export function emptyRolfp(): Rolfp {
  // Annotate so the literal `0` keeps its RiskScore narrowing (otherwise TS
  // widens to `number` and the Rolfp cell assignment fails).
  const zero = (): { c: RiskScore; i: RiskScore; a: RiskScore } => ({
    c: 0,
    i: 0,
    a: 0,
  });
  return {
    reputation: zero(),
    operational: zero(),
    legal: zero(),
    financial: zero(),
    personal: zero(),
  };
}

export function maxPerCia(r: Rolfp): { c: number; i: number; a: number } {
  const dims = [
    r.reputation,
    r.operational,
    r.legal,
    r.financial,
    r.personal,
  ];
  return {
    c: Math.max(...dims.map((d) => d.c)),
    i: Math.max(...dims.map((d) => d.i)),
    a: Math.max(...dims.map((d) => d.a)),
  };
}
