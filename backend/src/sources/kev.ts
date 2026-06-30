// CISA KEV enrichment source (CVE-keyed). Fetches the FULL Known Exploited
// Vulnerabilities catalog ONCE per enrich() call (no per-CVE API; the catalog is
// not persisted whole), builds the cveID set, then projects a row for EVERY
// requested CVE: { inKev, kevDateAdded?, kevDueDate?, ransomware? }. inKev:false
// records "checked, not in KEV". Never throws.
import { z } from 'zod';
import { httpGetJson } from './base';
import { RateLimiter } from './rateLimit';
import type { CveData, SourceDeps, SourceResult, VulnEnrichSource } from './types';

export interface KevConfig {
  feedUrl: string;
  timeoutMs: number;
  retries: number;
  rateMax: number;
  rateWindowMs: number;
}

const KevEntry = z.object({
  cveID: z.string().min(1),
  dateAdded: z.string().optional(),
  dueDate: z.string().optional(),
  knownRansomwareCampaignUse: z.string().optional(),
});
const KevCatalog = z.object({ vulnerabilities: z.array(KevEntry) });

export function createKevSource(cfg: KevConfig): VulnEnrichSource {
  const limiter = new RateLimiter(cfg.rateMax, cfg.rateWindowMs);
  return { id: 'kev', enrich: (cveIds, deps) => doEnrich(cfg, limiter, cveIds, deps) };
}

async function doEnrich(cfg: KevConfig, limiter: RateLimiter, cveIds: string[], deps: SourceDeps): Promise<SourceResult> {
  const res = await httpGetJson(cfg.feedUrl, { timeoutMs: cfg.timeoutMs, retries: cfg.retries, limiter }, deps);
  if (!res.ok) return { ok: false, reason: res.reason };

  const parsed = KevCatalog.safeParse(res.body);
  if (!parsed.success) return { ok: false, reason: 'Parse' };

  const catalog = new Map<string, z.infer<typeof KevEntry>>();
  for (const e of parsed.data.vulnerabilities) catalog.set(e.cveID, e);

  const cveData = new Map<string, CveData>();
  for (const cve of cveIds) {
    const e = catalog.get(cve);
    if (!e) {
      cveData.set(cve, { inKev: false });
      continue;
    }
    cveData.set(cve, {
      inKev: true,
      ...(e.dateAdded ? { kevDateAdded: e.dateAdded } : {}),
      ...(e.dueDate ? { kevDueDate: e.dueDate } : {}),
      ransomware: e.knownRansomwareCampaignUse === 'Known',
    });
  }

  return { ok: true, cveIds, cveData };
}
