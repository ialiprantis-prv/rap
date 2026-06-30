import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createEpssSource, type EpssConfig } from '../../src/sources/epss';
import type { FetchFn } from '../../src/sources/types';
import { fakeFetch } from '../helpers/sources';

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = (name: string): unknown => JSON.parse(readFileSync(path.resolve(here, '../fixtures/sources/epss', name), 'utf8'));

const cfg = (over: Partial<EpssConfig> = {}): EpssConfig => ({
  baseUrl: 'https://epss.test',
  timeoutMs: 1000,
  retries: 0,
  rateMax: 100,
  rateWindowMs: 1000,
  ...over,
});
const deps = (fetchFn: FetchFn) => ({ fetchFn, now: () => Date.now() });

test('builds request: comma-separated cve list, /data/v1/epss path', async () => {
  const { fetchFn, calls } = fakeFetch(() => ({ body: fx('empty.json') }));
  await createEpssSource(cfg()).enrich(['CVE-2024-0001', 'CVE-2024-0002'], deps(fetchFn));
  expect(calls[0].url).toContain('https://epss.test/data/v1/epss?');
  expect(calls[0].url).toContain('cve=' + encodeURIComponent('CVE-2024-0001,CVE-2024-0002'));
});

test('parses data[] into per-CVE epss/percentile/epssDate', async () => {
  const { fetchFn } = fakeFetch(() => ({ body: fx('full.json') }));
  const r = await createEpssSource(cfg()).enrich(['CVE-2024-0001', 'CVE-2024-0002'], deps(fetchFn));
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.cveIds).toEqual(['CVE-2024-0001', 'CVE-2024-0002']);
    expect(r.cveData?.get('CVE-2024-0001')).toEqual({ epss: 0.97012, percentile: 0.99943, epssDate: '2026-06-01' });
    expect(r.cveData?.get('CVE-2024-0002')?.epss).toBe(0.00042);
  }
});

test('chunks the CVE list into <= batchSize per call', async () => {
  const { fetchFn, calls } = fakeFetch(() => ({ body: fx('empty.json') }));
  const ids = ['CVE-A', 'CVE-B', 'CVE-C'];
  await createEpssSource(cfg({ batchSize: 2 })).enrich(ids, deps(fetchFn));
  expect(calls.length).toBe(2);
  expect(calls[0].url).toContain('cve=' + encodeURIComponent('CVE-A,CVE-B'));
  expect(calls[1].url).toContain('cve=' + encodeURIComponent('CVE-C'));
});

test('paginates offset/limit when a chunk is capped below total', async () => {
  const { fetchFn, calls } = fakeFetch(({ call }) =>
    call === 0
      ? { body: { total: 2, offset: 0, limit: 1, data: [{ cve: 'CVE-1', epss: '0.1', percentile: '0.2' }] } }
      : { body: { total: 2, offset: 1, limit: 1, data: [{ cve: 'CVE-2', epss: '0.3', percentile: '0.4' }] } },
  );
  const r = await createEpssSource(cfg()).enrich(['CVE-1', 'CVE-2'], deps(fetchFn));
  expect(calls.length).toBe(2);
  expect(calls[1].url).toContain('offset=1');
  if (r.ok) expect(r.cveIds).toEqual(['CVE-1', 'CVE-2']);
});

test('CVEs EPSS does not know carry no datum', async () => {
  const { fetchFn } = fakeFetch(() => ({ body: { total: 0, offset: 0, limit: 100, data: [] } }));
  const r = await createEpssSource(cfg()).enrich(['CVE-UNKNOWN'], deps(fetchFn));
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.cveData?.has('CVE-UNKNOWN')).toBe(false);
});

test('429 -> RateLimited; 5xx -> Http; network -> Network; malformed -> Parse', async () => {
  const ids = ['CVE-1'];
  const r429 = fakeFetch(() => ({ status: 429, headers: { 'retry-after': '1' } }));
  expect(await createEpssSource(cfg()).enrich(ids, deps(r429.fetchFn))).toMatchObject({ ok: false, reason: 'RateLimited' });
  const r5xx = fakeFetch(() => ({ status: 503, body: {} }));
  expect(await createEpssSource(cfg()).enrich(ids, deps(r5xx.fetchFn))).toMatchObject({ ok: false, reason: 'Http' });
  const rNet = fakeFetch(() => ({ rejectName: 'TypeError' }));
  expect(await createEpssSource(cfg()).enrich(ids, deps(rNet.fetchFn))).toMatchObject({ ok: false, reason: 'Network' });
  const rBad = fakeFetch(() => ({ body: fx('error.json') }));
  expect(await createEpssSource(cfg()).enrich(ids, deps(rBad.fetchFn))).toMatchObject({ ok: false, reason: 'Parse' });
});

describe('timeout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  test('hung request -> Timeout', async () => {
    const { fetchFn } = fakeFetch(() => ({ hang: true }));
    const p = createEpssSource(cfg()).enrich(['CVE-1'], deps(fetchFn));
    await vi.advanceTimersByTimeAsync(1000);
    expect(await p).toMatchObject({ ok: false, reason: 'Timeout' });
  });
});
