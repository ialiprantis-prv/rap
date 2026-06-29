// Assembles the enabled source slots from config (C4a NVD, C4b OSV).
// RAP_SOURCES_OFFLINE is the master kill switch; per-source flags gate each one.
import type { Config } from '../config';
import { createNvdSource } from './nvd';
import { createOsvSource } from './osv';
import type { IdentityKind, SourceId, VulnMatchSource } from './types';

export interface MatchSlot {
  id: SourceId;
  identityKind: IdentityKind;
  source: VulnMatchSource;
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
