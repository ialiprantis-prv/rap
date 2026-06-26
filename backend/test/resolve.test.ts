import { afterEach, beforeEach, expect, test } from 'vitest';
import { createDb, type DbHandle } from '../src/db/client';
import * as cache from '../src/repository/vulnCache';
import type { MatchSlot } from '../src/sources/registry';
import { warmAndResolve, type ResolveDeps } from '../src/sources/resolve';
import type { SourceResult } from '../src/sources/types';
import { fixedClock, stubMatchSource } from './helpers/sources';
import { MIGRATIONS_DIR, TEST_ORG_ID } from './helpers/app';

const NOW = 10_000;
const TTL = 1000;
const ID = { cpe: 'cpe:2.3:a:v:p:1' };
const KEY = { orgId: TEST_ORG_ID, source: 'nvd' as const, identityKind: 'cpe' as const, identityValue: ID.cpe };

let handle: DbHandle;
beforeEach(() => {
  handle = createDb({ url: ':memory:', migrationsDir: MIGRATIONS_DIR });
});
afterEach(() => handle.close());

function slot(impl: () => SourceResult, enabled = true): MatchSlot & { source: ReturnType<typeof stubMatchSource> } {
  const source = stubMatchSource('nvd', 'cpe', impl);
  return { id: 'nvd', identityKind: 'cpe', source, enabled, ttlMs: TTL };
}
function deps(s: MatchSlot): ResolveDeps {
  return { fetchFn: globalThis.fetch, now: fixedClock(NOW), slots: [s] };
}
const fresh = (cveIds: string[]) => cache.upsertMatchSuccess(handle.db, KEY, { cveIds, fetchedAt: NOW, expiresAt: NOW + TTL });

test('cold -> fetch, cache, resolve (with cvss)', async () => {
  const s = slot(() => ({ ok: true, cveIds: ['CVE-1'], cveData: new Map([['CVE-1', { cvss: 9 }]]) }));
  const r = await warmAndResolve(handle.db, TEST_ORG_ID, [ID], {}, deps(s));
  expect(r.cveIds).toEqual(['CVE-1']);
  expect(r.sources.nvd).toMatchObject({ state: 'ok', counts: { fetched: 1, failed: 0 } });
  expect(s.source.calls).toBe(1);
  expect(cache.getEdges(handle.db, KEY)).toEqual(['CVE-1']);
  expect(cache.getCveEnrich(handle.db, { orgId: TEST_ORG_ID, source: 'nvd', cveId: 'CVE-1' })?.payload).toEqual({ cvss: 9 });
});

test('fresh -> no fetch', async () => {
  fresh(['CVE-9']);
  const s = slot(() => {
    throw new Error('must not fetch a fresh entry');
  });
  const r = await warmAndResolve(handle.db, TEST_ORG_ID, [ID], {}, deps(s));
  expect(s.source.calls).toBe(0);
  expect(r.cveIds).toEqual(['CVE-9']);
  expect(r.sources.nvd).toMatchObject({ state: 'ok', counts: { fetched: 0 } });
});

test('expired -> refetch', async () => {
  cache.upsertMatchSuccess(handle.db, KEY, { cveIds: ['OLD'], fetchedAt: 0, expiresAt: 5000 });
  const s = slot(() => ({ ok: true, cveIds: ['NEW'] }));
  const r = await warmAndResolve(handle.db, TEST_ORG_ID, [ID], {}, deps(s));
  expect(s.source.calls).toBe(1);
  expect(r.cveIds).toEqual(['NEW']);
  expect(r.sources.nvd?.state).toBe('ok');
});

test('force -> refetch even when fresh', async () => {
  fresh(['OLD']);
  const s = slot(() => ({ ok: true, cveIds: ['NEW'] }));
  const r = await warmAndResolve(handle.db, TEST_ORG_ID, [ID], { force: true }, deps(s));
  expect(s.source.calls).toBe(1);
  expect(r.cveIds).toEqual(['NEW']);
});

test('disabled -> no fetch, disabled state, no CVEs', async () => {
  const s = slot(() => {
    throw new Error('must not fetch when disabled');
  }, false);
  const r = await warmAndResolve(handle.db, TEST_ORG_ID, [ID], {}, deps(s));
  expect(s.source.calls).toBe(0);
  expect(r.sources.nvd?.state).toBe('disabled');
  expect(r.cveIds).toEqual([]);
});

test('cold + down -> unavailable', async () => {
  const s = slot(() => ({ ok: false, reason: 'Network' }));
  const r = await warmAndResolve(handle.db, TEST_ORG_ID, [ID], {}, deps(s));
  expect(r.sources.nvd).toMatchObject({ state: 'unavailable', counts: { failed: 1 } });
  expect(r.cveIds).toEqual([]);
});

test('warm + down -> stale:unreachable, still serves prior CVEs', async () => {
  fresh(['CVE-7']);
  const s = slot(() => ({ ok: false, reason: 'Timeout' }));
  const r = await warmAndResolve(handle.db, TEST_ORG_ID, [ID], { force: true }, deps(s));
  expect(r.sources.nvd).toMatchObject({ state: 'stale', reason: 'unreachable' });
  expect(r.cveIds).toEqual(['CVE-7']);
});
