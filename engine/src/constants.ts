// Centralized methodology constants — the locked numeric kernel. Every value
// here is ported VERBATIM from risk-frontend (riskComputation.ts,
// d3fend/effectiveness.ts, probabilitySuggest.ts). Single source of truth so the
// methodology cannot drift across the modules that consume it.

import type { D3fendTactic } from './types/mitigation';

/** Risk scale ceiling: max product 1 x 4 x 4 x 5 = 80. */
export const RISK_SCALE_MAX = 80;

/** Band thresholds: Low 0-8 / Medium 9-29 / High 30-80. */
export const BAND_THRESHOLDS = {
  mediumMin: 9,
  highMin: 30,
  max: RISK_SCALE_MAX,
} as const;

/** Default effectiveness (severity delta, <= 0) per D3FEND tactic. PRIVACT
 *  modelling choice, NOT a D3FEND-published value. Negative = severity
 *  reduction; effectiveness acts on the Severity factor only. */
export const TACTIC_EFFECT: Record<D3fendTactic, number> = {
  Isolate: -3,
  Harden: -2,
  Deceive: -1,
  Detect: -1,
  Evict: 0,
  Restore: 0,
  Model: 0,
};

/** Threat-probability baseline = mid of the 0-4 Threat Scale. */
export const PROB_BASELINE = 2;

/** Purdue/ISA-95 zone -> deliberate-threat exposure modifier. Absent (custom)
 *  zone = 0 (neutral). */
export const ZONE_EXPOSURE: Record<string, number> = {
  'L0 Process': -1,
  'L1 Basic Control': -1,
  'L2 Supervisory Control': -1,
  'L3 Operations': 0,
  'L3.5 DMZ': 0,
  'L4 Enterprise': 1,
  'L5 Internet/Cloud': 1,
};
