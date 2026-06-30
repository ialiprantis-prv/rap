// ENISA EUVD enrichment source (CVE-keyed, BEST-EFFORT). One GET {base}/search
// per CVE with the full param set and text={cveId}, then FILTER items whose
// `aliases` (newline-split) contains the EXACT cveId and capture that record's
// { euvdId, cvss?, cvssVector?, epss?, references? }. No exact-alias match -> no
// datum (reached, just empty; NOT a failure). Never throws.
//
// Per-CVE failure resilience: because EUVD makes one call per CVE, a single
// consistently-failing/mis-parsing CVE must NOT abort the whole batch (that would
// block all EUVD enrichment every run and discard partial matches). So instead of
// returning {ok:false} on the first hard failure, EUVD ALWAYS returns ok:true and
// reports the hard-failed CVEs in `failed` — the service records those per-CVE so
// they retry next pass, while reachable no-match CVEs cache as ok-empty. A full
// outage therefore surfaces as every CVE failed (-> stale/unavailable), distinct
// from "reached, nothing matched".
//
// R2/NOTE: the EUVD `text` param is documented to search DESCRIPTIONS, not
// aliases, and a live probe timed out — so this may yield little. The
// search+filter is kept isolated and easy to swap; empty results are expected,
// not a bug. A generous per-source timeout is used (EUVD is slow).
import { z } from 'zod';
import { httpGetJson } from './base';
import { RateLimiter } from './rateLimit';
import type { CveData, SourceDeps, SourceResult, VulnEnrichSource } from './types';

export interface EuvdConfig {
  baseUrl: string;
  timeoutMs: number;
  retries: number;
  rateMax: number;
  rateWindowMs: number;
}

const EuvdItem = z.object({
  id: z.string().min(1),
  aliases: z.string().optional(),
  baseScore: z.coerce.number().optional(),
  baseScoreVector: z.string().optional(),
  epss: z.coerce.number().optional(),
  references: z.string().optional(),
});
const EuvdResponse = z.object({ items: z.array(EuvdItem), total: z.coerce.number() });

/** The fixed EUVD search params (besides `text`); kept here so the query is easy to tune. */
function searchUrl(baseUrl: string, cveId: string): string {
  const p = new URLSearchParams({
    assigner: '',
    product: '',
    vendor: '',
    fromDate: '',
    toDate: '',
    fromScore: '0',
    toScore: '10',
    fromEpss: '0',
    toEpss: '100',
    exploited: 'false',
    page: '0',
    size: '10',
    text: cveId,
  });
  return `${baseUrl}/search?${p.toString()}`;
}

/** The EUVD item whose aliases contain the exact cveId, or null. */
function matchExactAlias(items: z.infer<typeof EuvdItem>[], cveId: string): z.infer<typeof EuvdItem> | null {
  for (const item of items) {
    const aliases = (item.aliases ?? '').split('\n').map((a) => a.trim());
    if (aliases.includes(cveId)) return item;
  }
  return null;
}

export function createEuvdSource(cfg: EuvdConfig): VulnEnrichSource {
  const limiter = new RateLimiter(cfg.rateMax, cfg.rateWindowMs);
  return { id: 'euvd', enrich: (cveIds, deps) => doEnrich(cfg, limiter, cveIds, deps) };
}

async function doEnrich(cfg: EuvdConfig, limiter: RateLimiter, cveIds: string[], deps: SourceDeps): Promise<SourceResult> {
  const cveData = new Map<string, CveData>();
  const failed: string[] = [];

  for (const cve of cveIds) {
    const res = await httpGetJson(searchUrl(cfg.baseUrl, cve), { timeoutMs: cfg.timeoutMs, retries: cfg.retries, limiter }, deps);
    if (!res.ok) {
      failed.push(cve); // hard failure for THIS CVE only; keep going
      continue;
    }

    const parsed = EuvdResponse.safeParse(res.body);
    if (!parsed.success) {
      failed.push(cve);
      continue;
    }

    const item = matchExactAlias(parsed.data.items, cve);
    if (!item) continue; // reached, no exact-alias match -> no datum (expected)

    cveData.set(cve, {
      euvdId: item.id,
      ...(item.baseScore !== undefined ? { cvss: item.baseScore } : {}),
      ...(item.baseScoreVector ? { cvssVector: item.baseScoreVector } : {}),
      ...(item.epss !== undefined ? { epss: item.epss } : {}),
      ...(item.references ? { references: item.references } : {}),
    });
  }

  return { ok: true, cveIds: [...cveData.keys()], cveData, failed };
}
