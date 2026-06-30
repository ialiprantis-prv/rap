// Vulnerability cache repository (C4a). Functional, org-scoped. Drizzle is
// confined here + db/*. Reads are cache-only (D4); freshness/served-state is a
// pure function so it is independently testable with an injected clock.
import { and, eq, inArray } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { vulnMatchEdge, vulnSourceCve, vulnSourceMatch } from '../db/schema';
import type { VulnSourceCve, VulnSourceMatch } from '../db/schema';
import { canonicalIdentityValue, normalizeIdentityKind, normalizeSourceId } from '../sources/normalize';
import type { AssetIdentity, CveData, IdentityKind, ServedState, SourceId } from '../sources/types';

export interface MatchKey {
  orgId: string;
  source: SourceId;
  identityKind: IdentityKind;
  identityValue: string;
}

/** Canonicalise source + identity_kind so a mis-cased variant can never collide. */
function normMatchKey(k: MatchKey): MatchKey {
  return { ...k, source: normalizeSourceId(k.source), identityKind: normalizeIdentityKind(k.identityKind) };
}

function normCveKey(k: CveKey): CveKey {
  return { ...k, source: normalizeSourceId(k.source) };
}

export interface CacheStateResult {
  state: ServedState;
  staleAsOf?: number;
  reason?: string;
}

/**
 * Pure served-state classifier. Order: disabled -> cold/no-success unavailable
 * -> last-attempt-failed (with prior success) unreachable stale -> expired stale
 * -> ok. Unreachable is tested BEFORE expired: a failed last attempt is the
 * salient, actionable signal for an air-gapped operator and must not be
 * shadowed by TTL expiry.
 */
export function cacheState(
  row: Pick<VulnSourceMatch, 'fetchedAt' | 'expiresAt' | 'lastStatus'> | undefined,
  now: number,
  enabled: boolean,
): CacheStateResult {
  if (!enabled) return { state: 'disabled' };
  if (!row || row.fetchedAt === null) return { state: 'unavailable' };
  if (row.lastStatus === 'error') return { state: 'stale', staleAsOf: row.fetchedAt, reason: 'unreachable' };
  if (row.expiresAt !== null && now > row.expiresAt) return { state: 'stale', staleAsOf: row.fetchedAt, reason: 'expired' };
  return { state: 'ok' };
}

function whereMatch(k: MatchKey) {
  return and(
    eq(vulnSourceMatch.orgId, k.orgId),
    eq(vulnSourceMatch.source, k.source),
    eq(vulnSourceMatch.identityKind, k.identityKind),
    eq(vulnSourceMatch.identityValue, k.identityValue),
  );
}

export function getMatchHeader(db: AppDb, key: MatchKey): VulnSourceMatch | undefined {
  return db.select().from(vulnSourceMatch).where(whereMatch(normMatchKey(key))).get();
}

export function getEdges(db: AppDb, key: MatchKey): string[] {
  const k = normMatchKey(key);
  const rows = db
    .select({ cveId: vulnMatchEdge.cveId })
    .from(vulnMatchEdge)
    .where(
      and(
        eq(vulnMatchEdge.orgId, k.orgId),
        eq(vulnMatchEdge.source, k.source),
        eq(vulnMatchEdge.identityKind, k.identityKind),
        eq(vulnMatchEdge.identityValue, k.identityValue),
      ),
    )
    .all();
  return rows.map((r) => r.cveId);
}

/** Atomically replaces the match header and its CVE edges on a successful fetch. */
export function upsertMatchSuccess(
  db: AppDb,
  key: MatchKey,
  input: { cveIds: string[]; fetchedAt: number; expiresAt: number },
): void {
  const k = normMatchKey(key);
  db.transaction((tx) => {
    tx.insert(vulnSourceMatch)
      .values({ ...k, fetchedAt: input.fetchedAt, expiresAt: input.expiresAt, lastAttemptAt: input.fetchedAt, lastStatus: 'ok', lastError: null })
      .onConflictDoUpdate({
        target: [vulnSourceMatch.orgId, vulnSourceMatch.source, vulnSourceMatch.identityKind, vulnSourceMatch.identityValue],
        set: { fetchedAt: input.fetchedAt, expiresAt: input.expiresAt, lastAttemptAt: input.fetchedAt, lastStatus: 'ok', lastError: null },
      })
      .run();
    tx.delete(vulnMatchEdge)
      .where(
        and(
          eq(vulnMatchEdge.orgId, k.orgId),
          eq(vulnMatchEdge.source, k.source),
          eq(vulnMatchEdge.identityKind, k.identityKind),
          eq(vulnMatchEdge.identityValue, k.identityValue),
        ),
      )
      .run();
    if (input.cveIds.length > 0) {
      tx.insert(vulnMatchEdge)
        .values(input.cveIds.map((cveId) => ({ ...k, cveId })))
        .run();
    }
  });
}

/** Records a failed match attempt; KEEPS any existing edges and prior success. */
export function recordMatchFailure(db: AppDb, key: MatchKey, at: number, error: string): void {
  const k = normMatchKey(key);
  db.insert(vulnSourceMatch)
    .values({ ...k, fetchedAt: null, expiresAt: null, lastAttemptAt: at, lastStatus: 'error', lastError: error })
    .onConflictDoUpdate({
      target: [vulnSourceMatch.orgId, vulnSourceMatch.source, vulnSourceMatch.identityKind, vulnSourceMatch.identityValue],
      set: { lastAttemptAt: at, lastStatus: 'error', lastError: error },
    })
    .run();
}

/** Join header+edges for the given identities (all sources) -> distinct CVE ids. */
export function resolveMatches(db: AppDb, orgId: string, identities: AssetIdentity[]): string[] {
  const seen = new Set<string>();
  for (const identity of identities) {
    for (const [identityKind, identityValue] of identityPairs(identity)) {
      for (const cveId of getEdgesAnySource(db, orgId, identityKind, identityValue)) seen.add(cveId);
    }
  }
  return [...seen];
}

function getEdgesAnySource(db: AppDb, orgId: string, identityKind: IdentityKind, identityValue: string): string[] {
  const rows = db
    .select({ cveId: vulnMatchEdge.cveId })
    .from(vulnMatchEdge)
    .where(and(eq(vulnMatchEdge.orgId, orgId), eq(vulnMatchEdge.identityKind, identityKind), eq(vulnMatchEdge.identityValue, identityValue)))
    .all();
  return rows.map((r) => r.cveId);
}

export function identityPairs(identity: AssetIdentity): [IdentityKind, string][] {
  const pairs: [IdentityKind, string][] = [];
  const cpe = canonicalIdentityValue('cpe', identity);
  if (cpe) pairs.push(['cpe', cpe]);
  const purl = canonicalIdentityValue('purl', identity);
  if (purl) pairs.push(['purl', purl]);
  return pairs;
}

export interface CveKey {
  orgId: string;
  source: SourceId;
  cveId: string;
}

export function getCveEnrich(db: AppDb, key: CveKey): VulnSourceCve | undefined {
  const k = normCveKey(key);
  return db
    .select()
    .from(vulnSourceCve)
    .where(and(eq(vulnSourceCve.orgId, k.orgId), eq(vulnSourceCve.source, k.source), eq(vulnSourceCve.cveId, k.cveId)))
    .get();
}

/** All cached enrich rows for (org, source) over a CVE set -> keyed by cveId. */
export function getCveEnrichSet(db: AppDb, orgId: string, source: SourceId, cveIds: string[]): Map<string, VulnSourceCve> {
  const out = new Map<string, VulnSourceCve>();
  if (cveIds.length === 0) return out;
  const src = normalizeSourceId(source);
  const rows = db
    .select()
    .from(vulnSourceCve)
    .where(and(eq(vulnSourceCve.orgId, orgId), eq(vulnSourceCve.source, src), inArray(vulnSourceCve.cveId, cveIds)))
    .all();
  for (const r of rows) out.set(r.cveId, r);
  return out;
}

export function upsertCveEnrich(
  db: AppDb,
  key: CveKey,
  input: { payload: CveData; fetchedAt: number; expiresAt: number },
): void {
  const k = normCveKey(key);
  db.insert(vulnSourceCve)
    .values({ ...k, payload: input.payload, fetchedAt: input.fetchedAt, expiresAt: input.expiresAt, lastAttemptAt: input.fetchedAt, lastStatus: 'ok', lastError: null })
    .onConflictDoUpdate({
      target: [vulnSourceCve.orgId, vulnSourceCve.source, vulnSourceCve.cveId],
      set: { payload: input.payload, fetchedAt: input.fetchedAt, expiresAt: input.expiresAt, lastAttemptAt: input.fetchedAt, lastStatus: 'ok', lastError: null },
    })
    .run();
}

export function recordCveFailure(db: AppDb, key: CveKey, at: number, error: string): void {
  const k = normCveKey(key);
  db.insert(vulnSourceCve)
    .values({ ...k, payload: null, fetchedAt: null, expiresAt: null, lastAttemptAt: at, lastStatus: 'error', lastError: error })
    .onConflictDoUpdate({
      target: [vulnSourceCve.orgId, vulnSourceCve.source, vulnSourceCve.cveId],
      set: { lastAttemptAt: at, lastStatus: 'error', lastError: error },
    })
    .run();
}
