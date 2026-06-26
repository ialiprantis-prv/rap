// NVD CVE API 2.0 match source (CPE-based). Queries virtualMatchString, sends
// the apiKey header when configured, paginates startIndex/resultsPerPage, and
// extracts cveIds plus per-CVE CVSS base score (cached for C6, unused in C4a).
import { z } from 'zod';
import { httpGetJson } from './base';
import { RateLimiter } from './rateLimit';
import type { AssetIdentity, CveData, SourceDeps, SourceResult, VulnMatchSource } from './types';

export interface NvdConfig {
  baseUrl: string;
  apiKey?: string;
  timeoutMs: number;
  retries: number;
  rateMax: number;
  rateWindowMs: number;
  resultsPerPage?: number;
}

const CvssArray = z.array(z.object({ cvssData: z.object({ baseScore: z.number() }) }));
const CveItem = z.object({
  cve: z.object({
    id: z.string().min(1),
    metrics: z
      .object({
        cvssMetricV31: CvssArray.optional(),
        cvssMetricV30: CvssArray.optional(),
        cvssMetricV2: CvssArray.optional(),
      })
      .optional(),
  }),
});
const NvdPage = z.object({ totalResults: z.number(), vulnerabilities: z.array(CveItem) });

type Metrics = z.infer<typeof CveItem>['cve']['metrics'];

/** Prefer CVSS v3.1, then v3.0, then v2 base score. */
function pickCvss(m: Metrics): number | undefined {
  return (
    m?.cvssMetricV31?.[0]?.cvssData.baseScore ??
    m?.cvssMetricV30?.[0]?.cvssData.baseScore ??
    m?.cvssMetricV2?.[0]?.cvssData.baseScore
  );
}

export function createNvdSource(cfg: NvdConfig): VulnMatchSource {
  const limiter = new RateLimiter(cfg.rateMax, cfg.rateWindowMs);
  return { id: 'nvd', identityKind: 'cpe', match: (identity, deps) => doMatch(cfg, limiter, identity, deps) };
}

async function doMatch(
  cfg: NvdConfig,
  limiter: RateLimiter,
  identity: AssetIdentity,
  deps: SourceDeps,
): Promise<SourceResult> {
  const cpe = identity.cpe?.trim();
  if (!cpe) return { ok: true, cveIds: [] }; // NVD is CPE-keyed; nothing to match

  const perPage = cfg.resultsPerPage ?? 2000;
  const headers = cfg.apiKey ? { apiKey: cfg.apiKey } : undefined;
  const cveIds: string[] = [];
  const cveData = new Map<string, CveData>();

  for (let startIndex = 0; ; ) {
    const url =
      `${cfg.baseUrl}?virtualMatchString=${encodeURIComponent(cpe)}` +
      `&resultsPerPage=${String(perPage)}&startIndex=${String(startIndex)}`;
    const res = await httpGetJson(
      url,
      { timeoutMs: cfg.timeoutMs, retries: cfg.retries, limiter, ...(headers ? { headers } : {}) },
      deps,
    );
    if (!res.ok) return { ok: false, reason: res.reason };

    const parsed = NvdPage.safeParse(res.body);
    if (!parsed.success) return { ok: false, reason: 'Parse' };

    for (const item of parsed.data.vulnerabilities) {
      const id = item.cve.id;
      if (!cveData.has(id)) cveIds.push(id);
      const cvss = pickCvss(item.cve.metrics);
      cveData.set(id, cvss !== undefined ? { cvss } : {});
    }

    startIndex += perPage;
    if (parsed.data.vulnerabilities.length === 0 || startIndex >= parsed.data.totalResults) break;
  }

  return { ok: true, cveIds, cveData };
}
