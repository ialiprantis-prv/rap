// Assembles the enabled source slots from config. C4a wires NVD only.
// RAP_SOURCES_OFFLINE is the master kill switch; per-source flags gate each one.
import type { Config } from '../config';
import { createNvdSource } from './nvd';
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
  return [
    {
      id: 'nvd',
      identityKind: 'cpe',
      source: nvd,
      enabled: !config.sourcesOffline && config.sourceNvdEnabled,
      ttlMs: config.vulnCacheTtlNvdMs,
    },
  ];
}
