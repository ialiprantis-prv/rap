// Engine kernel subset — normalized vulnerability record. Ported from
// risk-frontend src/lib/vulnSources/types.ts (minimal: the methodology reads
// cveId, defaultSeverity, exploited, and cweIds; CVSS summary is carried for
// downstream display/severity derivation).

export type VulnSourceId = 'nvd-cpe' | 'nvd-cve' | 'osv' | 'euvd';

/** CVSS summary attached to a normalized vuln record. `score` 0-10. */
export interface CvssSummary {
  score: number;
  vector?: string;
  version?: string; // '4.0' | '3.1' | '2.0'
}

/** Normalized vulnerability record (one per (asset, CVE)). `defaultSeverity` is
 *  populated by the source adapter (the engine's canonical CVSS->severity rule is
 *  `defaultSeverityFromCvss` = round(CVSS/2) in methodology/severity.ts);
 *  `severityOverride` is
 *  analyst data merged in at read time, not stored here. */
export interface VulnRecord {
  cveId: string;
  description?: string;
  cvss?: CvssSummary;
  /** Source-adapter-derived internal severity (0-5). Undefined => indeterminate. */
  defaultSeverity?: number;
  exploited: boolean; // CISA KEV
  cweIds: string[];
  sources?: VulnSourceId[];
  affectedAssetId?: string;
  /** The asset CPE (or purl) the match came from. */
  matchedOn?: string;
}
