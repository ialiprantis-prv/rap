// Threat-probability SUGGESTION engine (heuristic, NOT authoritative). Ported
// verbatim from risk-frontend src/lib/probabilitySuggest.ts. The analyst owns
// every probability that enters the formula; this only pre-fills a starting
// value they can override.
//
// RULE:
//   baseline = 2 (mid of the 0-4 Threat Scale).
//   For DELIBERATE threats only, a Purdue/ISA-95 zone-exposure modifier (proxy
//   for network reachability), clamped 0-4. Custom (non-Purdue) zones = neutral.
//   Non-deliberate threats get the flat baseline.

import type { ThreatOrigin } from '../types/catalog';
import { PROB_BASELINE, ZONE_EXPOSURE } from '../constants';

export { PROB_BASELINE, ZONE_EXPOSURE };

export function suggestProbability(origin: ThreatOrigin, zone: string): number {
  if (!origin.deliberate) return PROB_BASELINE;
  const mod = ZONE_EXPOSURE[zone] ?? 0;
  return Math.min(4, Math.max(0, PROB_BASELINE + mod));
}
