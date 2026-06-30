// CVE-keyed enrichment fan-out (C4c). Mirrors the match-side warmAndResolve: for
// each enabled enrich source, check per-CVE cache freshness via cacheState, fetch
// only the stale/missing CVEs (or all on force), upsert results, record failures,
// and report a per-source served state. Per-source independence; reads are
// cache-only and writes mark every queried CVE "checked" (empty payload when the
// source has no datum), so an enrich is not retried until its TTL lapses.
//
// Each source writes its OWN vuln_source_cve(source=...) row — there is NO merge
// or precedence here (that is the resolved view / C6). KEV is special-cased: when
// any CVE in the set is stale/missing it refetches the FULL set, because one
// catalog fetch refreshes every CVE at once.
import type { AppDb } from '../db/client';
import * as cache from '../repository/vulnCache';
import type { EnrichSlot } from './registry';
import type { ServedState, SourceDeps, SourceId } from './types';

export interface EnrichDeps extends SourceDeps {
  slots: EnrichSlot[];
}

export interface EnrichCounts {
  cves: number;
  fetched: number;
  failed: number;
}

export interface EnrichOutcome {
  state: ServedState;
  fetchedAt?: number;
  staleAsOf?: number;
  reason?: string;
  counts: EnrichCounts;
}

export interface EnrichResult {
  sources: Partial<Record<SourceId, EnrichOutcome>>;
}

const STATE_RANK: Record<ServedState, number> = { ok: 0, stale: 1, unavailable: 2, disabled: 3 };

export async function enrichResolved(
  db: AppDb,
  orgId: string,
  cveIds: string[],
  opts: { force?: boolean },
  deps: EnrichDeps,
): Promise<EnrichResult> {
  const sources: Partial<Record<SourceId, EnrichOutcome>> = {};
  const unique = [...new Set(cveIds)];

  for (const slot of deps.slots) {
    if (!slot.enabled) {
      sources[slot.id] = { state: 'disabled', counts: { cves: unique.length, fetched: 0, failed: 0 } };
      continue;
    }

    const counts: EnrichCounts = { cves: unique.length, fetched: 0, failed: 0 };

    // Which CVEs need a refresh (missing/expired/unreachable, or all on force).
    const before = cache.getCveEnrichSet(db, orgId, slot.id, unique);
    const stale = opts.force
      ? unique
      : unique.filter((cve) => cache.cacheState(before.get(cve), deps.now(), true).state !== 'ok');

    // KEV refreshes the whole set from one catalog fetch; EPSS/EUVD fetch just the stale CVEs.
    const fetchSet = slot.id === 'kev' ? (stale.length > 0 ? unique : []) : stale;

    if (fetchSet.length > 0) {
      const res = await slot.source.enrich(fetchSet, deps);
      const at = deps.now();
      if (res.ok) {
        // Per-CVE outcome: a CVE the source reports in `failed` (a per-CVE hard
        // failure, e.g. EUVD) is recorded as a failure so it retries next pass;
        // every other CVE caches (empty payload when there is simply no datum).
        const failed = new Set(res.failed ?? []);
        for (const cve of fetchSet) {
          if (failed.has(cve)) {
            counts.failed++;
            cache.recordCveFailure(db, { orgId, source: slot.id, cveId: cve }, at, 'Http');
          } else {
            counts.fetched++;
            cache.upsertCveEnrich(db, { orgId, source: slot.id, cveId: cve }, { payload: res.cveData?.get(cve) ?? {}, fetchedAt: at, expiresAt: at + slot.ttlMs });
          }
        }
      } else {
        // Wholesale single-call failure (EPSS/KEV): the whole fetch set failed.
        counts.failed = fetchSet.length;
        for (const cve of fetchSet) cache.recordCveFailure(db, { orgId, source: slot.id, cveId: cve }, at, res.reason);
      }
    }

    sources[slot.id] = buildOutcome(db, orgId, slot.id, unique, deps.now(), counts);
  }

  return { sources };
}

/** Worst served-state across the requested CVE set, with the newest success time. */
function buildOutcome(db: AppDb, orgId: string, source: SourceId, cveIds: string[], now: number, counts: EnrichCounts): EnrichOutcome {
  const after = cache.getCveEnrichSet(db, orgId, source, cveIds);
  let worst: cache.CacheStateResult = { state: 'ok' };
  let newestFetchedAt: number | undefined;
  for (const cve of cveIds) {
    const row = after.get(cve);
    const st = cache.cacheState(row, now, true);
    if (STATE_RANK[st.state] > STATE_RANK[worst.state]) worst = st;
    if (row?.fetchedAt != null && (newestFetchedAt === undefined || row.fetchedAt > newestFetchedAt)) newestFetchedAt = row.fetchedAt;
  }
  const out: EnrichOutcome = { state: worst.state, counts };
  if (newestFetchedAt !== undefined) out.fetchedAt = newestFetchedAt;
  if (worst.staleAsOf !== undefined) out.staleAsOf = worst.staleAsOf;
  if (worst.reason !== undefined) out.reason = worst.reason;
  return out;
}
