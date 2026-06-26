// Identity-driven warm-and-resolve (C4a). For each identity x enabled match
// source: check cache freshness, fetch only when missing/expired (or all when
// force), upsert the cache, then resolve CVEs CACHE-ONLY (D4). The
// assessment -> identities binding is C5; this is list-driven.
import type { AppDb } from '../db/client';
import * as cache from '../repository/vulnCache';
import type { MatchSlot } from './registry';
import type { AssetIdentity, ServedState, SourceDeps, SourceId } from './types';

export interface ResolveDeps extends SourceDeps {
  slots: MatchSlot[];
}

export interface SourceCounts {
  identities: number;
  fetched: number;
  failed: number;
}

export interface SourceOutcome {
  state: ServedState;
  fetchedAt?: number;
  staleAsOf?: number;
  reason?: string;
  counts: SourceCounts;
}

export interface ResolveResult {
  cveIds: string[];
  sources: Partial<Record<SourceId, SourceOutcome>>;
}

const STATE_RANK: Record<ServedState, number> = { ok: 0, stale: 1, unavailable: 2, disabled: 3 };

export async function warmAndResolve(
  db: AppDb,
  orgId: string,
  identities: AssetIdentity[],
  opts: { force?: boolean },
  deps: ResolveDeps,
): Promise<ResolveResult> {
  const cveIds = new Set<string>();
  const sources: Partial<Record<SourceId, SourceOutcome>> = {};

  for (const slot of deps.slots) {
    const applicable = identities.filter((i) => i[slot.identityKind]);
    if (!slot.enabled) {
      sources[slot.id] = { state: 'disabled', counts: { identities: applicable.length, fetched: 0, failed: 0 } };
      continue;
    }

    const counts: SourceCounts = { identities: applicable.length, fetched: 0, failed: 0 };
    let worst: cache.CacheStateResult = { state: 'ok' };
    let newestFetchedAt: number | undefined;

    for (const identity of applicable) {
      const key = { orgId, source: slot.id, identityKind: slot.identityKind, identityValue: identity[slot.identityKind]! };
      const header = cache.getMatchHeader(db, key);
      if (opts.force || isStale(header, deps.now())) {
        counts.fetched++;
        const res = await slot.source.match(identity, deps);
        if (res.ok) {
          const at = deps.now();
          cache.upsertMatchSuccess(db, key, { cveIds: res.cveIds, fetchedAt: at, expiresAt: at + slot.ttlMs });
          for (const id of res.cveIds) {
            const cvss = res.cveData?.get(id)?.cvss;
            cache.upsertCveEnrich(db, { orgId, source: slot.id, cveId: id }, { payload: cvss !== undefined ? { cvss } : {}, fetchedAt: at, expiresAt: at + slot.ttlMs });
          }
        } else {
          counts.failed++;
          cache.recordMatchFailure(db, key, deps.now(), res.reason);
        }
      }

      for (const id of cache.getEdges(db, key)) cveIds.add(id);
      const after = cache.getMatchHeader(db, key);
      // `disabled` is handled by the early-continue above, so enabled=true here
      // is intentional — cacheState stays the single source of truth.
      const st = cache.cacheState(after, deps.now(), true);
      if (STATE_RANK[st.state] > STATE_RANK[worst.state]) worst = st;
      if (after?.fetchedAt != null && (newestFetchedAt === undefined || after.fetchedAt > newestFetchedAt)) {
        newestFetchedAt = after.fetchedAt;
      }
    }

    sources[slot.id] = buildOutcome(worst, newestFetchedAt, counts);
  }

  return { cveIds: [...cveIds], sources };
}

function isStale(header: ReturnType<typeof cache.getMatchHeader>, now: number): boolean {
  return !header || header.fetchedAt === null || header.expiresAt === null || now > header.expiresAt;
}

function buildOutcome(worst: cache.CacheStateResult, newestFetchedAt: number | undefined, counts: SourceCounts): SourceOutcome {
  const out: SourceOutcome = { state: worst.state, counts };
  if (newestFetchedAt !== undefined) out.fetchedAt = newestFetchedAt;
  if (worst.staleAsOf !== undefined) out.staleAsOf = worst.staleAsOf;
  if (worst.reason !== undefined) out.reason = worst.reason;
  return out;
}
