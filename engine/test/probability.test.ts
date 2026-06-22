// Locks the probability heuristic: baseline 2 + Purdue zone modifier for
// DELIBERATE threats only; custom zones neutral; non-deliberate flat baseline.

import { describe, it, expect } from 'vitest';
import { suggestProbability, type ThreatOrigin } from '../src/index';

const deliberate: ThreatOrigin = { deliberate: true, accidental: false };
const accidental: ThreatOrigin = { deliberate: false, accidental: true };

describe('suggestProbability — baseline 2 + Purdue zone modifier', () => {
  it('deliberate L5 Internet/Cloud -> 3 (+1)', () => {
    expect(suggestProbability(deliberate, 'L5 Internet/Cloud')).toBe(3);
  });

  it('deliberate L0 Process -> 1 (-1)', () => {
    expect(suggestProbability(deliberate, 'L0 Process')).toBe(1);
  });

  it('deliberate custom (non-Purdue) zone -> 2 (neutral)', () => {
    expect(suggestProbability(deliberate, 'Some Custom Zone')).toBe(2);
  });

  it('non-deliberate threat -> flat baseline 2 regardless of zone', () => {
    expect(suggestProbability(accidental, 'L5 Internet/Cloud')).toBe(2);
    expect(suggestProbability(accidental, 'L0 Process')).toBe(2);
  });
});
