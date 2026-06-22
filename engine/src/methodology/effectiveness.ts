// D3FEND countermeasure effectiveness + the STRONGEST-ONLY composition rule.
// Ported verbatim from risk-frontend src/lib/d3fend/effectiveness.ts. The
// per-tactic defaults (TACTIC_EFFECT) live in constants.ts; effectiveness acts
// on the Severity factor only and never stacks (strongest single, no addition).

import type { AppliedCountermeasure } from '../types/mitigation';
import { TACTIC_EFFECT } from '../constants';

export { TACTIC_EFFECT };

/** Clamp an analyst override to the locked integer range [-5, 0]. */
export function clampOverride(value: number): number {
  return Math.max(-5, Math.min(0, Math.round(value)));
}

/** Effective effectiveness of one applied countermeasure: override ?? default. */
export function effectiveEffect(
  cm: Pick<AppliedCountermeasure, 'tacticId' | 'effectivenessOverride'>,
): number {
  if (cm.effectivenessOverride !== undefined) return clampOverride(cm.effectivenessOverride);
  return TACTIC_EFFECT[cm.tacticId];
}

/** Strongest-only magnitude (>= 0) across applied countermeasures. Never additive. */
export function strongestMagnitude(cms: readonly AppliedCountermeasure[]): number {
  let m = 0;
  for (const cm of cms) m = Math.max(m, Math.abs(effectiveEffect(cm)));
  return m;
}
