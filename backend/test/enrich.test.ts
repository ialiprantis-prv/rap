import { afterEach, beforeEach, expect, test } from 'vitest';
import { createDb, type DbHandle } from '../src/db/client';
import * as cache from '../src/repository/vulnCache';
import { enrichResolved, type EnrichDeps } from '../src/sources/enrich';
import type { EnrichSlot } from '../src/sources/registry';
import type { SourceId, SourceResult } from '../src/sources/types';
import { fixedClock, seedCveRow, stubEnrichSource } from './helpers/sources';
import { MIGRATIONS_DIR, TEST_ORG_ID } from './helpers/app';

const NOW = 10_000;
const TTL = 1000;
const CVES = ['CVE-1', 'CVE-2'];

let handle: DbHandle;
beforeEach(() => {
  handle = createDb({ url: ':memory:', migrationsDir: MIGRATIONS_DIR });
});
afterEach(() => handle.close());

function eslot(id: SourceId, impl: (cveIds: string[]) => SourceResult, enabled = true): EnrichSlot & { source: ReturnType<typeof stubEnrichSource> } {
  return { id, source: stubEnrichSource(id, impl), enabled, ttlMs: TTL };
}
function deps(slots: EnrichSlot[]): EnrichDeps {
  return { fetchFn: globalThis.fetch, now: fixedClock(NOW), slots };
}
const payload = (source: SourceId, cveId: string) => cache.getCveEnrich(handle.db, { orgId: TEST_ORG_ID, source, cveId })?.payload;

test('fans out EPSS + KEV + EUVD over a CVE set; rows written, empty where no datum', async () => {
  const epss = eslot('epss', () => ({ ok: true, cveIds: ['CVE-1'], cveData: new Map([['CVE-1', { epss: 0.5, percentile: 0.9 }]]) }));
  const kev = eslot('kev', (ids) => ({ ok: true, cveIds: ids, cveData: new Map(ids.map((c) => [c, { inKev: c === 'CVE-1' }])) }));
  const euvd = eslot('euvd', () => ({ ok: true, cveIds: ['CVE-2'], cveData: new Map([['CVE-2', { euvdId: 'EUVD-9' }]]) }));

  const r = await enrichResolved(handle.db, TEST_ORG_ID, CVES, {}, deps([epss, kev, euvd]));

  expect(r.sources.epss).toMatchObject({ state: 'ok', counts: { cves: 2, fetched: 2, failed: 0 } });
  expect(r.sources.kev?.state).toBe('ok');
  expect(r.sources.euvd?.state).toBe('ok');
  // EPSS: CVE-1 has datum, CVE-2 was checked -> empty payload (not refetched until TTL).
  expect(payload('epss', 'CVE-1')).toEqual({ epss: 0.5, percentile: 0.9 });
  expect(payload('epss', 'CVE-2')).toEqual({});
  // KEV: a row per requested CVE, inKev true/false.
  expect(payload('kev', 'CVE-1')).toEqual({ inKev: true });
  expect(payload('kev', 'CVE-2')).toEqual({ inKev: false });
  // EUVD: CVE-2 matched, CVE-1 checked-empty.
  expect(payload('euvd', 'CVE-2')).toEqual({ euvdId: 'EUVD-9' });
  expect(payload('euvd', 'CVE-1')).toEqual({});
  expect([epss.source.calls, kev.source.calls, euvd.source.calls]).toEqual([1, 1, 1]);
});

test('cached-fresh -> no fetch', async () => {
  for (const source of ['epss', 'kev', 'euvd'] as const)
    for (const cveId of CVES) seedCveRow(handle, { source, cveId, payload: {}, fetchedAt: NOW, expiresAt: NOW + TTL });
  const slots = [
    eslot('epss', () => { throw new Error('must not fetch'); }),
    eslot('kev', () => { throw new Error('must not fetch'); }),
    eslot('euvd', () => { throw new Error('must not fetch'); }),
  ];
  const r = await enrichResolved(handle.db, TEST_ORG_ID, CVES, {}, deps(slots));
  expect(slots.map((s) => s.source.calls)).toEqual([0, 0, 0]);
  expect(r.sources.epss).toMatchObject({ state: 'ok', counts: { fetched: 0 } });
});

test('expired -> refetch (per-CVE staleness on EPSS/EUVD)', async () => {
  seedCveRow(handle, { source: 'epss', cveId: 'CVE-1', payload: { epss: 0.1 }, fetchedAt: 0, expiresAt: 5000 });
  seedCveRow(handle, { source: 'epss', cveId: 'CVE-2', payload: { epss: 0.2 }, fetchedAt: NOW, expiresAt: NOW + TTL });
  const epss = eslot('epss', (ids) => ({ ok: true, cveIds: ids, cveData: new Map(ids.map((c) => [c, { epss: 0.99 }])) }));
  await enrichResolved(handle.db, TEST_ORG_ID, CVES, {}, deps([epss]));
  expect(epss.source.calls).toBe(1);
  expect(epss.source.lastCveIds).toEqual(['CVE-1']); // only the expired one
  expect(payload('epss', 'CVE-1')).toEqual({ epss: 0.99 });
});

test('KEV refetches the FULL set when any one CVE is stale (single catalog fetch)', async () => {
  seedCveRow(handle, { source: 'kev', cveId: 'CVE-1', payload: { inKev: true }, fetchedAt: NOW, expiresAt: NOW + TTL });
  // CVE-2 missing -> stale -> KEV must re-pull the whole set.
  const kev = eslot('kev', (ids) => ({ ok: true, cveIds: ids, cveData: new Map(ids.map((c) => [c, { inKev: false }])) }));
  await enrichResolved(handle.db, TEST_ORG_ID, CVES, {}, deps([kev]));
  expect(kev.source.calls).toBe(1);
  expect(kev.source.lastCveIds.sort()).toEqual(['CVE-1', 'CVE-2']);
});

test('force -> refetch all even when fresh', async () => {
  for (const cveId of CVES) seedCveRow(handle, { source: 'epss', cveId, payload: { epss: 0.1 }, fetchedAt: NOW, expiresAt: NOW + TTL });
  const epss = eslot('epss', (ids) => ({ ok: true, cveIds: ids, cveData: new Map(ids.map((c) => [c, { epss: 0.9 }])) }));
  await enrichResolved(handle.db, TEST_ORG_ID, CVES, { force: true }, deps([epss]));
  expect(epss.source.calls).toBe(1);
  expect(epss.source.lastCveIds.sort()).toEqual(['CVE-1', 'CVE-2']);
});

test('disabled -> skipped, disabled state, no fetch', async () => {
  const epss = eslot('epss', () => { throw new Error('must not fetch'); }, false);
  const r = await enrichResolved(handle.db, TEST_ORG_ID, CVES, {}, deps([epss]));
  expect(epss.source.calls).toBe(0);
  expect(r.sources.epss).toMatchObject({ state: 'disabled', counts: { cves: 2 } });
});

test('per-source independence: EUVD down + EPSS/KEV ok', async () => {
  const epss = eslot('epss', (ids) => ({ ok: true, cveIds: ids, cveData: new Map(ids.map((c) => [c, { epss: 0.3 }])) }));
  const kev = eslot('kev', (ids) => ({ ok: true, cveIds: ids, cveData: new Map(ids.map((c) => [c, { inKev: false }])) }));
  const euvd = eslot('euvd', () => ({ ok: false, reason: 'Network' }));
  const r = await enrichResolved(handle.db, TEST_ORG_ID, CVES, {}, deps([epss, kev, euvd]));
  expect(r.sources.epss?.state).toBe('ok');
  expect(r.sources.kev?.state).toBe('ok');
  expect(r.sources.euvd).toMatchObject({ state: 'unavailable', counts: { failed: 2 } }); // cold + down
  expect(payload('epss', 'CVE-1')).toEqual({ epss: 0.3 });
  expect(cache.getCveEnrich(handle.db, { orgId: TEST_ORG_ID, source: 'euvd', cveId: 'CVE-1' })?.lastStatus).toBe('error');
});

test('EUVD poison CVE: failed CVE recorded (retried next pass), the others enriched', async () => {
  const THREE = ['CVE-1', 'CVE-2', 'CVE-3'];
  // CVE-1 matches, CVE-2 reached-but-no-match (empty), CVE-3 hard-fails.
  const euvd = eslot('euvd', () => ({ ok: true, cveIds: ['CVE-1'], cveData: new Map([['CVE-1', { euvdId: 'EUVD-1' }]]), failed: ['CVE-3'] }));
  const r = await enrichResolved(handle.db, TEST_ORG_ID, THREE, {}, deps([euvd]));
  expect(payload('euvd', 'CVE-1')).toEqual({ euvdId: 'EUVD-1' });
  expect(payload('euvd', 'CVE-2')).toEqual({}); // reached, no datum -> cached empty
  expect(cache.getCveEnrich(handle.db, { orgId: TEST_ORG_ID, source: 'euvd', cveId: 'CVE-3' })?.lastStatus).toBe('error');
  expect(r.sources.euvd?.counts).toMatchObject({ fetched: 2, failed: 1 });

  // Next pass: CVE-1/CVE-2 are fresh, only the failed CVE-3 is retried.
  const euvd2 = eslot('euvd', (ids) => ({ ok: true, cveIds: ids, cveData: new Map(ids.map((c) => [c, { euvdId: 'EUVD-3' }])), failed: [] }));
  await enrichResolved(handle.db, TEST_ORG_ID, THREE, {}, deps([euvd2]));
  expect(euvd2.source.lastCveIds).toEqual(['CVE-3']);
  expect(payload('euvd', 'CVE-3')).toEqual({ euvdId: 'EUVD-3' });
});

test('full EUVD outage: every CVE failed -> source unavailable (cold), not ok', async () => {
  const euvd = eslot('euvd', (ids) => ({ ok: true, cveIds: [], cveData: new Map(), failed: ids }));
  const r = await enrichResolved(handle.db, TEST_ORG_ID, CVES, {}, deps([euvd]));
  expect(r.sources.euvd).toMatchObject({ state: 'unavailable', counts: { fetched: 0, failed: 2 } });
  expect(cache.getCveEnrich(handle.db, { orgId: TEST_ORG_ID, source: 'euvd', cveId: 'CVE-1' })?.lastStatus).toBe('error');
});

test('full EUVD outage with prior success -> stale:unreachable (retried, prior datum kept)', async () => {
  for (const cveId of CVES) seedCveRow(handle, { source: 'euvd', cveId, payload: { euvdId: 'OLD' }, fetchedAt: 0, expiresAt: 5000 }); // expired
  const euvd = eslot('euvd', (ids) => ({ ok: true, cveIds: [], cveData: new Map(), failed: ids }));
  const r = await enrichResolved(handle.db, TEST_ORG_ID, CVES, {}, deps([euvd]));
  expect(r.sources.euvd).toMatchObject({ state: 'stale', reason: 'unreachable' });
  expect(payload('euvd', 'CVE-1')).toEqual({ euvdId: 'OLD' }); // prior datum preserved
});

test('warm + down -> stale:unreachable, keeps prior payload', async () => {
  for (const cveId of CVES) seedCveRow(handle, { source: 'epss', cveId, payload: { epss: 0.7 }, fetchedAt: 0, expiresAt: 5000 }); // expired
  const epss = eslot('epss', () => ({ ok: false, reason: 'Timeout' }));
  const r = await enrichResolved(handle.db, TEST_ORG_ID, CVES, {}, deps([epss]));
  expect(r.sources.epss).toMatchObject({ state: 'stale', reason: 'unreachable' });
  expect(payload('epss', 'CVE-1')).toEqual({ epss: 0.7 }); // prior datum preserved
});
