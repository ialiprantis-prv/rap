// OSV.dev /v1/query match source (purl-based). One query per identity, paginated
// via next_page_token. Per the OSV rule "version OR versioned purl, never both":
// a versioned purl -> {package:{purl}}; an unversioned purl + a declared version
// -> {package:{purl},version}; neither -> skip. OSV ids are GHSA/PYSEC/OSV; the
// CVE lives in record.aliases — emit one edge per CVE alias, drop records with
// none. Severity (a CVSS vector) is captured for C6, not consumed here.
import { z } from 'zod';
import { httpPostJson } from './base';
import { RateLimiter } from './rateLimit';
import type { AssetIdentity, CveData, SourceDeps, SourceResult, VulnMatchSource } from './types';

export interface OsvConfig {
  baseUrl: string;
  timeoutMs: number;
  retries: number;
  rateMax: number;
  rateWindowMs: number;
}

const CVE_RE = /^CVE-\d{4}-\d+$/;

const OsvVuln = z.object({
  id: z.string(),
  aliases: z.array(z.string()).optional(),
  severity: z.array(z.object({ type: z.string(), score: z.string() })).optional(),
});
const OsvResponse = z.object({
  vulns: z.array(OsvVuln).optional(),
  next_page_token: z.string().optional(),
});

type Severity = z.infer<typeof OsvVuln>['severity'];

/** Prefer a CVSS v3 vector, then v4, then whatever is present. */
function pickVector(sev: Severity): string | undefined {
  if (!sev || sev.length === 0) return undefined;
  return (sev.find((s) => s.type.startsWith('CVSS_V3')) ?? sev.find((s) => s.type.startsWith('CVSS_V4')) ?? sev[0]).score;
}

interface QueryBody {
  package: { purl: string };
  version?: string;
}

/** Builds the OSV query body, or null when the identity cannot be queried. */
function buildQueryBody(identity: AssetIdentity): QueryBody | null {
  const purl = identity.purl?.trim();
  if (!purl) return null;
  if (purl.includes('@')) return { package: { purl } }; // versioned purl
  const version = identity.version?.trim();
  return version ? { package: { purl }, version } : null; // unversioned + version, else skip
}

export function createOsvSource(cfg: OsvConfig): VulnMatchSource {
  const limiter = new RateLimiter(cfg.rateMax, cfg.rateWindowMs);
  return { id: 'osv', identityKind: 'purl', match: (identity, deps) => doMatch(cfg, limiter, identity, deps) };
}

async function doMatch(cfg: OsvConfig, limiter: RateLimiter, identity: AssetIdentity, deps: SourceDeps): Promise<SourceResult> {
  const base = buildQueryBody(identity);
  if (!base) return { ok: true, cveIds: [] };

  const url = `${cfg.baseUrl}/v1/query`;
  const cveIds: string[] = [];
  const cveData = new Map<string, CveData>();
  let pageToken: string | undefined;

  for (;;) {
    const body = JSON.stringify(pageToken ? { ...base, page_token: pageToken } : base);
    const res = await httpPostJson(
      url,
      { body, headers: { 'content-type': 'application/json' }, timeoutMs: cfg.timeoutMs, retries: cfg.retries, limiter },
      deps,
    );
    if (!res.ok) return { ok: false, reason: res.reason };

    const parsed = OsvResponse.safeParse(res.body);
    if (!parsed.success) return { ok: false, reason: 'Parse' };

    for (const vuln of parsed.data.vulns ?? []) {
      const cves = (vuln.aliases ?? []).filter((a) => CVE_RE.test(a));
      if (cves.length === 0) continue; // GHSA/PYSEC-only -> drop silently
      const vector = pickVector(vuln.severity);
      for (const cve of cves) {
        if (!cveData.has(cve)) cveIds.push(cve);
        cveData.set(cve, vector !== undefined ? { cvssVector: vector } : {});
      }
    }

    if (!parsed.data.next_page_token) break;
    pageToken = parsed.data.next_page_token;
  }

  return { ok: true, cveIds, cveData };
}
