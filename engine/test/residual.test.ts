// Locks the severity-only residual model: strongest-single D3FEND delta (never
// additive), remediate dominates, override clamp [-5, 0].

import { describe, it, expect } from 'vitest';
import {
  residualSeverity,
  strongestMagnitude,
  clampOverride,
  type AppliedCountermeasure,
  type MitigationRecord,
} from '../src/index';

const cm = (tacticId: AppliedCountermeasure['tacticId'], effectivenessDefault: number): AppliedCountermeasure => ({
  techniqueId: `D3-${tacticId}`,
  tacticId,
  effectivenessDefault,
});

const rec = (countermeasures: AppliedCountermeasure[], remediate = false): MitigationRecord => ({
  assetId: 'ast-1',
  cveId: 'CVE-0000-0001',
  countermeasures,
  ...(remediate ? { remediate: {} } : {}),
});

describe('residual — severity-only, strongest-single', () => {
  it('sev 5 + Isolate (-3) -> residual severity 2', () => {
    expect(residualSeverity(5, rec([cm('Isolate', -3)]))).toBe(2);
  });

  it('remediate dominates -> residual severity 0', () => {
    expect(residualSeverity(5, rec([cm('Isolate', -3)], true))).toBe(0);
  });

  it('Isolate + Harden -> strongest delta 3 (never additive 5)', () => {
    expect(strongestMagnitude([cm('Isolate', -3), cm('Harden', -2)])).toBe(3);
    expect(residualSeverity(5, rec([cm('Isolate', -3), cm('Harden', -2)]))).toBe(2);
  });

  it('clampOverride(-9) -> -5 (locked range floor)', () => {
    expect(clampOverride(-9)).toBe(-5);
  });

  it('indeterminate severity stays undefined unless remediated', () => {
    expect(residualSeverity(undefined, rec([]))).toBeUndefined();
    expect(residualSeverity(undefined, rec([], true))).toBe(0);
  });
});
