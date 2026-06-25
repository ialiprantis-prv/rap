import { readFileSync } from 'node:fs';
import type { KeyObject } from 'node:crypto';
import { verifyLicense, type LicenseSummary } from './verify';

export interface LicenseGateOptions {
  filePath: string;
  publicKey: KeyObject;
  log: (level: 'info' | 'error', msg: string) => void;
}

/**
 * Fail-closed startup gate: reads + verifies the license, logs one clear line,
 * and returns the verified summary. On ANY failure it logs which check failed
 * (with identity/expiry when parseable, no secrets) and exits the process.
 */
export function loadAndVerifyLicense(opts: LicenseGateOptions): LicenseSummary {
  let bytes: Buffer;
  try {
    bytes = readFileSync(opts.filePath);
  } catch {
    opts.log('error', `license check failed: cannot read license file at ${opts.filePath}`);
    return process.exit(1);
  }

  const result = verifyLicense(bytes, opts.publicKey);
  if (!result.ok) {
    const id = result.summary ? ` licenseId=${result.summary.licenseId} expiry=${result.summary.expiry}` : '';
    opts.log('error', `license check failed: ${result.reason}${id}`);
    return process.exit(1);
  }

  const s = result.summary;
  opts.log('info', `license OK: customer=${s.customer} licenseId=${s.licenseId} expiry=${s.expiry} seats=${s.seats}`);
  return s;
}
