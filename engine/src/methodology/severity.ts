// CVSS -> internal severity. Ported verbatim from the v3 LIVE rule in
// risk-frontend src/lib/vulnSources/types.ts (`defaultSeverityFromCvss`, the
// "Locked C4 default-severity rule"): round(CVSS / 2), clamped to 0-5. This is
// what the live kernel consumes — source adapters (nvdCve.ts, osv.ts) populate
// VulnRecord.defaultSeverity with it, and riskTriplets reads it via
// effectiveSeverity. Matches spec §8.2/§15.3 + scope-lock §1. Zero drift.
//
// (The v2 banded `legacySeverityFromCvss` from lib/cvss.ts is used ONLY by the
// v2 seed (mocks/data/vulnSeed.ts) and is intentionally NOT ported. `cvssColor`
// is a Mantine UI concern and is likewise not part of the presentation-free
// kernel.)

/** CVSS base score (0-10) -> internal severity (0-5) = round(score / 2). */
export function defaultSeverityFromCvss(score: number | undefined): number | undefined {
  if (score === undefined || Number.isNaN(score)) return undefined;
  return Math.min(5, Math.max(0, Math.round(score / 2)));
}

/** MITRE CWE definition URL for a numeric CWE id. */
export const cweUrl = (id: number) =>
  `https://cwe.mitre.org/data/definitions/${id}.html`;
