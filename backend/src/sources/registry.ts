// Assembles the enabled source slots from config: match (C4a NVD, C4b OSV) and
// enrich (C4c EPSS/KEV/EUVD). RAP_SOURCES_OFFLINE is the master kill switch;
// per-source flags gate each one.
import type { Config } from '../config';
import { createEpssSource } from './epss';
import { createEuvdSource } from './euvd';
import { createKevSource } from './kev';
import { createNvdSource } from './nvd';
import { createOsvSource } from './osv';
import type { IdentityKind, SourceId, VulnEnrichSource, VulnMatchSource } from './types';

export interface MatchSlot {
  id: SourceId;
  identityKind: IdentityKind;
  source: VulnMatchSource;
  enabled: boolean;
  ttlMs: number;
}

export interface EnrichSlot {
  id: SourceId;
  source: VulnEnrichSource;
  enabled: boolean;
  ttlMs: number;
}

export function buildMatchSlots(config: Config): MatchSlot[] {
  const nvd = createNvdSource({
    baseUrl: config.nvdBaseUrl,
    timeoutMs: config.sourceHttpTimeoutMs,
    retries: config.sourceHttpRetries,
    rateMax: config.nvdRateMax,
    rateWindowMs: config.nvdRateWindowMs,
    ...(config.nvdApiKey ? { apiKey: config.nvdApiKey } : {}),
  });
  const osv = createOsvSource({
    baseUrl: config.osvBaseUrl,
    timeoutMs: config.sourceHttpTimeoutMs,
    retries: config.sourceHttpRetries,
    rateMax: config.osvRateMax,
    rateWindowMs: config.osvRateWindowMs,
  });
  return [
    {
      id: 'nvd',
      identityKind: 'cpe',
      source: nvd,
      enabled: !config.sourcesOffline && config.sourceNvdEnabled,
      ttlMs: config.vulnCacheTtlNvdMs,
    },
    {
      id: 'osv',
      identityKind: 'purl',
      source: osv,
      enabled: !config.sourcesOffline && config.sourceOsvEnabled,
      ttlMs: config.vulnCacheTtlOsvMs,
    },
  ];
}

export function buildEnrichSlots(config: Config): EnrichSlot[] {
  const epss = createEpssSource({
    baseUrl: config.epssBaseUrl,
    timeoutMs: config.sourceHttpTimeoutMs,
    retries: config.sourceHttpRetries,
    rateMax: config.epssRateMax,
    rateWindowMs: config.epssRateWindowMs,
    batchSize: config.epssBatchSize,
  });
  const kev = createKevSource({
    feedUrl: config.kevFeedUrl,
    timeoutMs: config.sourceHttpTimeoutMs,
    retries: config.sourceHttpRetries,
    rateMax: config.kevRateMax,
    rateWindowMs: config.kevRateWindowMs,
  });
  const euvd = createEuvdSource({
    baseUrl: config.euvdBaseUrl,
    timeoutMs: config.euvdHttpTimeoutMs,
    retries: config.sourceHttpRetries,
    rateMax: config.euvdRateMax,
    rateWindowMs: config.euvdRateWindowMs,
  });
  return [
    { id: 'epss', source: epss, enabled: !config.sourcesOffline && config.sourceEpssEnabled, ttlMs: config.vulnCacheTtlEpssMs },
    { id: 'kev', source: kev, enabled: !config.sourcesOffline && config.sourceKevEnabled, ttlMs: config.vulnCacheTtlKevMs },
    { id: 'euvd', source: euvd, enabled: !config.sourcesOffline && config.sourceEuvdEnabled, ttlMs: config.vulnCacheTtlEuvdMs },
  ];
}
