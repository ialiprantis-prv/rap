import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createKevSource, type KevConfig } from '../../src/sources/kev';
import type { FetchFn } from '../../src/sources/types';
import { fakeFetch } from '../helpers/sources';

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = (name: string): unknown => JSON.parse(readFileSync(path.resolve(here, '../fixtures/sources/kev', name), 'utf8'));

const FEED = 'https://kev.test/kev.json';
const cfg = (over: Partial<KevConfig> = {}): KevConfig => ({
  feedUrl: FEED,
  timeoutMs: 1000,
  retries: 0,
  rateMax: 100,
  rateWindowMs: 1000,
  ...over,
});
const deps = (fetchFn: FetchFn) => ({ fetchFn, now: () => Date.now() });

test('fetches the full catalog ONCE per call, from the feed url', async () => {
  const { fetchFn, calls } = fakeFetch(() => ({ body: fx('catalog.json') }));
  await createKevSource(cfg()).enrich(['CVE-2024-0001', 'CVE-2024-0002', 'CVE-2024-9999'], deps(fetchFn));
  expect(calls.length).toBe(1);
  expect(calls[0].url).toBe(FEED);
});

test('projects inKev true AND false for every requested CVE', async () => {
  const { fetchFn } = fakeFetch(() => ({ body: fx('catalog.json') }));
  const r = await createKevSource(cfg()).enrich(['CVE-2024-0001', 'CVE-2024-0002'], deps(fetchFn));
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.cveData?.get('CVE-2024-0001')).toEqual({ inKev: true, kevDateAdded: '2024-01-15', kevDueDate: '2024-02-05', ransomware: true });
    expect(r.cveData?.get('CVE-2024-0002')).toEqual({ inKev: false }); // checked, not in KEV
  }
});

test('ransomware flag reflects knownRansomwareCampaignUse (Known vs Unknown)', async () => {
  const { fetchFn } = fakeFetch(() => ({ body: fx('catalog.json') }));
  const r = await createKevSource(cfg()).enrich(['CVE-2024-0001', 'CVE-2024-9999'], deps(fetchFn));
  if (r.ok) {
    expect(r.cveData?.get('CVE-2024-0001')?.ransomware).toBe(true); // "Known"
    expect(r.cveData?.get('CVE-2024-9999')?.ransomware).toBe(false); // "Unknown"
  }
});

test('429 -> RateLimited; 5xx -> Http; network -> Network; malformed -> Parse', async () => {
  const ids = ['CVE-2024-0001'];
  const r429 = fakeFetch(() => ({ status: 429, headers: { 'retry-after': '1' } }));
  expect(await createKevSource(cfg()).enrich(ids, deps(r429.fetchFn))).toMatchObject({ ok: false, reason: 'RateLimited' });
  const r5xx = fakeFetch(() => ({ status: 502, body: {} }));
  expect(await createKevSource(cfg()).enrich(ids, deps(r5xx.fetchFn))).toMatchObject({ ok: false, reason: 'Http' });
  const rNet = fakeFetch(() => ({ rejectName: 'TypeError' }));
  expect(await createKevSource(cfg()).enrich(ids, deps(rNet.fetchFn))).toMatchObject({ ok: false, reason: 'Network' });
  const rBad = fakeFetch(() => ({ body: fx('error.json') }));
  expect(await createKevSource(cfg()).enrich(ids, deps(rBad.fetchFn))).toMatchObject({ ok: false, reason: 'Parse' });
});

describe('timeout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  test('hung request -> Timeout', async () => {
    const { fetchFn } = fakeFetch(() => ({ hang: true }));
    const p = createKevSource(cfg()).enrich(['CVE-2024-0001'], deps(fetchFn));
    await vi.advanceTimersByTimeAsync(1000);
    expect(await p).toMatchObject({ ok: false, reason: 'Timeout' });
  });
});
