// FIRST.org EPSS enrichment source (CVE-keyed). GET {base}/data/v1/epss?cve=
// <comma list>, chunking the CVE ids into <=batchSize per call and paginating
// offset/limit if a chunk is capped. Yields per-CVE { epss, percentile, epssDate };
// CVEs EPSS does not know simply carry no datum. Never throws.
import { z } from 'zod';
import { httpGetJson } from './base';
import { RateLimiter } from './rateLimit';
import type { CveData, SourceDeps, SourceResult, VulnEnrichSource } from './types';

export interface EpssConfig {
  baseUrl: string;
  timeoutMs: number;
  retries: number;
  rateMax: number;
  rateWindowMs: number;
  batchSize?: number;
}

const EpssDatum = z.object({
  cve: z.string().min(1),
  epss: z.coerce.number(),
  percentile: z.coerce.number(),
  date: z.string().optional(),
});
const EpssPage = z.object({
  total: z.coerce.number(),
  offset: z.coerce.number(),
  limit: z.coerce.number(),
  data: z.array(EpssDatum),
});

const DEFAULT_BATCH_SIZE = 100;

export function createEpssSource(cfg: EpssConfig): VulnEnrichSource {
  const limiter = new RateLimiter(cfg.rateMax, cfg.rateWindowMs);
  return { id: 'epss', enrich: (cveIds, deps) => doEnrich(cfg, limiter, cveIds, deps) };
}

async function doEnrich(cfg: EpssConfig, limiter: RateLimiter, cveIds: string[], deps: SourceDeps): Promise<SourceResult> {
  const batch = cfg.batchSize ?? DEFAULT_BATCH_SIZE;
  const cveData = new Map<string, CveData>();
  const seen: string[] = [];

  for (let i = 0; i < cveIds.length; i += batch) {
    const chunk = cveIds.slice(i, i + batch);
    const cveParam = encodeURIComponent(chunk.join(','));
    // Page within a chunk only if the API caps the response below the chunk size.
    for (let offset = 0; ; ) {
      const url = `${cfg.baseUrl}/data/v1/epss?cve=${cveParam}&limit=${String(batch)}&offset=${String(offset)}`;
      const res = await httpGetJson(url, { timeoutMs: cfg.timeoutMs, retries: cfg.retries, limiter }, deps);
      if (!res.ok) return { ok: false, reason: res.reason };

      const parsed = EpssPage.safeParse(res.body);
      if (!parsed.success) return { ok: false, reason: 'Parse' };

      for (const d of parsed.data.data) {
        if (!cveData.has(d.cve)) seen.push(d.cve);
        cveData.set(d.cve, { epss: d.epss, percentile: d.percentile, ...(d.date ? { epssDate: d.date } : {}) });
      }

      offset += parsed.data.data.length;
      if (parsed.data.data.length === 0 || offset >= parsed.data.total) break;
    }
  }

  return { ok: true, cveIds: seen, cveData };
}
