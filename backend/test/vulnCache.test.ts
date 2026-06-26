import { afterEach, beforeEach, expect, test } from 'vitest';
import { createDb, type DbHandle } from '../src/db/client';
import * as cache from '../src/repository/vulnCache';
import type { SourceId } from '../src/sources/types';
import { MIGRATIONS_DIR, TEST_ORG_ID } from './helpers/app';

let handle: DbHandle;
beforeEach(() => {
  handle = createDb({ url: ':memory:', migrationsDir: MIGRATIONS_DIR });
});
afterEach(() => handle.close());

const key = (identityValue: string, source: SourceId = 'nvd'): cache.MatchKey => ({
  orgId: TEST_ORG_ID,
  source,
  identityKind: 'cpe',
  identityValue,
});

test('upsertMatchSuccess replaces edges and updates the header', () => {
  const k = key('cpe:a');
  cache.upsertMatchSuccess(handle.db, k, { cveIds: ['A', 'B'], fetchedAt: 100, expiresAt: 200 });
  expect(cache.getEdges(handle.db, k).sort()).toEqual(['A', 'B']);
  cache.upsertMatchSuccess(handle.db, k, { cveIds: ['B', 'C'], fetchedAt: 300, expiresAt: 400 });
  expect(cache.getEdges(handle.db, k).sort()).toEqual(['B', 'C']);
  expect(cache.getMatchHeader(handle.db, k)?.fetchedAt).toBe(300);
});

test('cacheState — all branches, unreachable taking precedence over expired (pure)', () => {
  expect(cache.cacheState(undefined, 0, false).state).toBe('disabled');
  expect(cache.cacheState(undefined, 0, true).state).toBe('unavailable');
  expect(cache.cacheState({ fetchedAt: null, expiresAt: null, lastStatus: 'error' }, 100, true).state).toBe('unavailable');
  // past TTL + last attempt OK -> expired
  expect(cache.cacheState({ fetchedAt: 0, expiresAt: 100, lastStatus: 'ok' }, 200, true)).toMatchObject({ state: 'stale', reason: 'expired', staleAsOf: 0 });
  // past TTL + last attempt FAILED -> unreachable (precedence over expired)
  expect(cache.cacheState({ fetchedAt: 0, expiresAt: 100, lastStatus: 'error' }, 200, true)).toMatchObject({ state: 'stale', reason: 'unreachable', staleAsOf: 0 });
  // within TTL + last attempt FAILED (forced warm+down) -> unreachable
  expect(cache.cacheState({ fetchedAt: 0, expiresAt: 1000, lastStatus: 'error' }, 500, true)).toMatchObject({ state: 'stale', reason: 'unreachable', staleAsOf: 0 });
  // within TTL + last attempt OK -> ok
  expect(cache.cacheState({ fetchedAt: 0, expiresAt: 1000, lastStatus: 'ok' }, 500, true).state).toBe('ok');
});

test('recordMatchFailure keeps edges and prior success', () => {
  const k = key('cpe:a');
  cache.upsertMatchSuccess(handle.db, k, { cveIds: ['A'], fetchedAt: 100, expiresAt: 1000 });
  cache.recordMatchFailure(handle.db, k, 500, 'Network');
  const h = cache.getMatchHeader(handle.db, k);
  expect(h?.fetchedAt).toBe(100);
  expect(h?.lastStatus).toBe('error');
  expect(cache.getEdges(handle.db, k)).toEqual(['A']);
});

test('recordMatchFailure on a cold key -> unavailable', () => {
  const k = key('cpe:cold');
  cache.recordMatchFailure(handle.db, k, 10, 'Timeout');
  const h = cache.getMatchHeader(handle.db, k);
  expect(h?.fetchedAt).toBeNull();
  expect(cache.cacheState(h, 10, true).state).toBe('unavailable');
});

test('rows are org-scoped', () => {
  const k = key('cpe:a');
  cache.upsertMatchSuccess(handle.db, k, { cveIds: ['A'], fetchedAt: 1, expiresAt: 2 });
  expect(cache.getEdges(handle.db, { ...k, orgId: 'other-org' })).toEqual([]);
  expect(cache.getMatchHeader(handle.db, { ...k, orgId: 'other-org' })).toBeUndefined();
});

test('cve enrich: upsert then failure keeps payload', () => {
  const ck = { orgId: TEST_ORG_ID, source: 'nvd' as const, cveId: 'CVE-1' };
  cache.upsertCveEnrich(handle.db, ck, { payload: { cvss: 7.5 }, fetchedAt: 1, expiresAt: 2 });
  expect(cache.getCveEnrich(handle.db, ck)?.payload).toEqual({ cvss: 7.5 });
  cache.recordCveFailure(handle.db, ck, 3, 'Http');
  const after = cache.getCveEnrich(handle.db, ck);
  expect(after?.lastStatus).toBe('error');
  expect(after?.payload).toEqual({ cvss: 7.5 });
});

test('resolveMatches unions edges across identities', () => {
  cache.upsertMatchSuccess(handle.db, key('cpe:a'), { cveIds: ['A', 'B'], fetchedAt: 1, expiresAt: 2 });
  cache.upsertMatchSuccess(
    handle.db,
    { orgId: TEST_ORG_ID, source: 'nvd', identityKind: 'purl', identityValue: 'pkg:x' },
    { cveIds: ['B', 'C'], fetchedAt: 1, expiresAt: 2 },
  );
  expect(cache.resolveMatches(handle.db, TEST_ORG_ID, [{ cpe: 'cpe:a' }, { purl: 'pkg:x' }]).sort()).toEqual(['A', 'B', 'C']);
});
