import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createEuvdSource, type EuvdConfig } from '../../src/sources/euvd';
import type { FetchFn } from '../../src/sources/types';
import { fakeFetch } from '../helpers/sources';

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = (name: string): unknown => JSON.parse(readFileSync(path.resolve(here, '../fixtures/sources/euvd', name), 'utf8'));

const cfg = (over: Partial<EuvdConfig> = {}): EuvdConfig => ({
  baseUrl: 'https://euvd.test/api',
  timeoutMs: 1000,
  retries: 0,
  rateMax: 100,
  rateWindowMs: 1000,
  ...over,
});
const deps = (fetchFn: FetchFn) => ({ fetchFn, now: () => Date.now() });

test('builds search request: /search with text={cve} and the full param set', async () => {
  const { fetchFn, calls } = fakeFetch(() => ({ body: { items: [], total: 0 } }));
  await createEuvdSource(cfg()).enrich(['CVE-2024-0001'], deps(fetchFn));
  const url = calls[0].url;
  expect(url).toContain('https://euvd.test/api/search?');
  expect(url).toContain('text=CVE-2024-0001');
  expect(url).toContain('fromScore=0');
  expect(url).toContain('toScore=10');
  expect(url).toContain('fromEpss=0');
  expect(url).toContain('toEpss=100');
  expect(url).toContain('exploited=false');
  expect(url).toContain('page=0');
  expect(url).toContain('size=10');
});

test('exact-alias match captured into euvdId/cvss/cvssVector/epss/references', async () => {
  const { fetchFn } = fakeFetch(() => ({ body: fx('match.json') }));
  const r = await createEuvdSource(cfg()).enrich(['CVE-2024-0001'], deps(fetchFn));
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.cveData?.get('CVE-2024-0001')).toEqual({
      euvdId: 'EUVD-2024-1234',
      cvss: 9.8,
      cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
      epss: 0.97012,
      references: 'https://example.com/advisory/1\nhttps://nvd.nist.gov/vuln/detail/CVE-2024-0001',
    });
  }
});

test('item without the exact alias is rejected -> ok + empty (reached, no datum)', async () => {
  const { fetchFn } = fakeFetch(() => ({ body: fx('nearmiss.json') }));
  const r = await createEuvdSource(cfg()).enrich(['CVE-2024-0001'], deps(fetchFn));
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.cveIds).toEqual([]);
    expect(r.cveData?.has('CVE-2024-0001')).toBe(false);
  }
});

test('multiple items -> picks the exact-alias record', async () => {
  const { fetchFn } = fakeFetch(() => ({
    body: {
      items: [
        { id: 'EUVD-NEAR', aliases: 'CVE-2024-9999', baseScore: 1.0 },
        { id: 'EUVD-EXACT', aliases: 'GHSA-x\nCVE-2024-0001', baseScore: 7.5 },
      ],
      total: 2,
    },
  }));
  const r = await createEuvdSource(cfg()).enrich(['CVE-2024-0001'], deps(fetchFn));
  if (r.ok) expect(r.cveData?.get('CVE-2024-0001')).toMatchObject({ euvdId: 'EUVD-EXACT', cvss: 7.5 });
});

test('one call per CVE; only the queried CVEs are searched', async () => {
  const { fetchFn, calls } = fakeFetch(() => ({ body: { items: [], total: 0 } }));
  await createEuvdSource(cfg()).enrich(['CVE-2024-0001', 'CVE-2024-0002'], deps(fetchFn));
  expect(calls.length).toBe(2);
  expect(calls[0].url).toContain('text=CVE-2024-0001');
  expect(calls[1].url).toContain('text=CVE-2024-0002');
});

test('a per-CVE hard failure (5xx/network/parse) -> ok:true, CVE reported in failed (not aborted)', async () => {
  const ids = ['CVE-2024-0001'];
  const r5xx = fakeFetch(() => ({ status: 500, body: {} }));
  expect(await createEuvdSource(cfg()).enrich(ids, deps(r5xx.fetchFn))).toMatchObject({ ok: true, cveIds: [], failed: ids });
  const rNet = fakeFetch(() => ({ rejectName: 'TypeError' }));
  expect(await createEuvdSource(cfg()).enrich(ids, deps(rNet.fetchFn))).toMatchObject({ ok: true, failed: ids });
  const rBad = fakeFetch(() => ({ body: fx('error.json') }));
  expect(await createEuvdSource(cfg()).enrich(ids, deps(rBad.fetchFn))).toMatchObject({ ok: true, failed: ids });
});

test('one poison CVE does not block the others: match + no-match + fail in one batch', async () => {
  // CVE-A matches, CVE-B reached-but-no-match, CVE-C hard-fails (5xx).
  const { fetchFn } = fakeFetch(({ url }) => {
    if (url.includes('text=CVE-C')) return { status: 503, body: {} };
    if (url.includes('text=CVE-A')) return { body: { items: [{ id: 'EUVD-A', aliases: 'CVE-A', baseScore: 8.1 }], total: 1 } };
    return { body: { items: [], total: 0 } }; // CVE-B no-match
  });
  const r = await createEuvdSource(cfg()).enrich(['CVE-A', 'CVE-B', 'CVE-C'], deps(fetchFn));
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.cveIds).toEqual(['CVE-A']);
    expect(r.cveData?.get('CVE-A')).toMatchObject({ euvdId: 'EUVD-A', cvss: 8.1 });
    expect(r.cveData?.has('CVE-B')).toBe(false); // reached, no datum
    expect(r.failed).toEqual(['CVE-C']);
  }
});

describe('timeout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  test('hung request -> CVE reported in failed (ok:true)', async () => {
    const { fetchFn } = fakeFetch(() => ({ hang: true }));
    const p = createEuvdSource(cfg()).enrich(['CVE-2024-0001'], deps(fetchFn));
    await vi.advanceTimersByTimeAsync(1000);
    expect(await p).toMatchObject({ ok: true, failed: ['CVE-2024-0001'] });
  });
});
