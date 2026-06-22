// Locks the v3 LIVE severity rule: defaultSeverityFromCvss = round(CVSS / 2)
// clamped 0-5 (spec §15.3 / scope-lock §1 / C4 locked decision). The 5.0 -> 3
// vector is the discriminator (Math.round(2.5) === 3); undefined passes through.

import { describe, it, expect } from 'vitest';
import { defaultSeverityFromCvss } from '../src/index';

describe('defaultSeverityFromCvss — round(CVSS/2) clamped 0-5 (v3 C4 live rule)', () => {
  it('maps CVSS base scores to internal severity', () => {
    expect(defaultSeverityFromCvss(9.8)).toBe(5); // round(4.9)
    expect(defaultSeverityFromCvss(7.0)).toBe(4); // round(3.5)
    expect(defaultSeverityFromCvss(5.5)).toBe(3); // round(2.75)
    expect(defaultSeverityFromCvss(5.0)).toBe(3); // round(2.5) === 3
    expect(defaultSeverityFromCvss(4.0)).toBe(2); // round(2.0)
    expect(defaultSeverityFromCvss(3.9)).toBe(2); // round(1.95)
    expect(defaultSeverityFromCvss(0)).toBe(0); // round(0)
    expect(defaultSeverityFromCvss(undefined)).toBeUndefined();
  });
});
