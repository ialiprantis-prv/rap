// Source-client interfaces (C4a). The engine stays pure — all network access
// lives here. Two interfaces: match (identifier -> CVE ids) and enrich
// (CVE ids -> per-CVE data). Both return a discriminated result and never throw.

export interface AssetIdentity {
  cpe?: string;
  purl?: string;
  vendor?: string;
  product?: string;
  version?: string;
  ecosystem?: string;
}

export type SourceId = 'nvd' | 'osv' | 'epss' | 'kev' | 'euvd';

/** Which identifier a cache row is keyed by. */
export type IdentityKind = 'cpe' | 'purl';

export type SourceFailureReason = 'Timeout' | 'RateLimited' | 'Http' | 'Parse' | 'Network';

/**
 * Per-CVE data carried alongside a match/enrich (cached now for C6, unconsumed).
 * cvss is a base score (NVD); cvssVector is a CVSS vector string (OSV).
 */
export interface CveData {
  cvss?: number;
  cvssVector?: string;
}

export type SourceResult =
  | { ok: true; cveIds: string[]; cveData?: Map<string, CveData> }
  | { ok: false; reason: SourceFailureReason };

export type FetchFn = typeof globalThis.fetch;

/** Injectables (testing): the fetch implementation and a clock. */
export interface SourceDeps {
  fetchFn: FetchFn;
  now: () => number;
}

export interface VulnMatchSource {
  id: SourceId;
  /** Which identifier this source matches on (keys the cache row). */
  identityKind: IdentityKind;
  match(identity: AssetIdentity, deps: SourceDeps): Promise<SourceResult>;
}

export interface VulnEnrichSource {
  id: SourceId;
  enrich(cveIds: string[], deps: SourceDeps): Promise<SourceResult>;
}

/** What a cached entry can be served as (D4). */
export type ServedState = 'ok' | 'stale' | 'unavailable' | 'disabled';

export interface Provenance {
  source: SourceId;
  fetchedAt: number;
  staleAsOf?: number;
  reason?: string;
}
