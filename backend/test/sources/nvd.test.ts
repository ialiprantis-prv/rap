import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createNvdSource, type NvdConfig } from '../../src/sources/nvd';
import type { FetchFn } from '../../src/sources/types';
import { fakeFetch } from '../helpers/sources';

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = (name: string): unknown => JSON.parse(readFileSync(path.resolve(here, '../fixtures/sources/nvd', name), 'utf8'));

const cfg = (over: Partial<NvdConfig> = {}): NvdConfig => ({
  baseUrl: 'https://nvd.test/cves/2.0',
  timeoutMs: 1000,
  retries: 0,
  rateMax: 100,
  rateWindowMs: 1000,
  ...over,
});
const deps = (fetchFn: FetchFn) => ({ fetchFn, now: () => Date.now() });
const CPE = 'cpe:2.3:a:vendor:product:1.0:*:*:*:*:*:*:*';

test('builds request: virtualMatchString, pagination params, apiKey header', async () => {
  const { fetchFn, calls } = fakeFetch(() => ({ body: fx('empty.json') }));
  await createNvdSource(cfg({ apiKey: 'SECRET-KEY' })).match({ cpe: CPE }, deps(fetchFn));
  const url = calls[0].url;
  expect(url).toContain('virtualMatchString=' + encodeURIComponent(CPE));
  expect(url).toContain('resultsPerPage=');
  expect(url).toContain('startIndex=0');
  expect((calls[0].init?.headers as Record<string, string>).apiKey).toBe('SECRET-KEY');
});

test('no apiKey header when key unset', async () => {
  const { fetchFn, calls } = fakeFetch(() => ({ body: fx('empty.json') }));
  await createNvdSource(cfg()).match({ cpe: CPE }, deps(fetchFn));
  expect(calls[0].init?.headers).toBeUndefined();
});

test('parses a full page into cveIds + per-CVE cvss', async () => {
  const { fetchFn } = fakeFetch(() => ({ body: fx('full.json') }));
  const r = await createNvdSource(cfg()).match({ cpe: CPE }, deps(fetchFn));
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.cveIds).toEqual(['CVE-2024-0001', 'CVE-2024-0002']);
    expect(r.cveData?.get('CVE-2024-0001')?.cvss).toBe(9.8);
    expect(r.cveData?.get('CVE-2024-0002')?.cvss).toBe(5.0);
  }
});

test('zero results -> ok with empty cveIds', async () => {
  const { fetchFn } = fakeFetch(() => ({ body: fx('empty.json') }));
  expect(await createNvdSource(cfg()).match({ cpe: CPE }, deps(fetchFn))).toEqual({ ok: true, cveIds: [], cveData: new Map() });
});

test('no cpe -> ok empty, no request made', async () => {
  const { fetchFn, calls } = fakeFetch(() => ({ body: fx('empty.json') }));
  expect(await createNvdSource(cfg()).match({ purl: 'pkg:npm/x@1' }, deps(fetchFn))).toEqual({ ok: true, cveIds: [] });
  expect(calls.length).toBe(0);
});

test('429 -> RateLimited', async () => {
  const { fetchFn } = fakeFetch(() => ({ status: 429, headers: { 'retry-after': '1' } }));
  expect(await createNvdSource(cfg()).match({ cpe: CPE }, deps(fetchFn))).toMatchObject({ ok: false, reason: 'RateLimited' });
});

test('5xx -> Http', async () => {
  const { fetchFn } = fakeFetch(() => ({ status: 503, body: {} }));
  expect(await createNvdSource(cfg()).match({ cpe: CPE }, deps(fetchFn))).toMatchObject({ ok: false, reason: 'Http' });
});

test('malformed body -> Parse', async () => {
  const { fetchFn } = fakeFetch(() => ({ body: fx('error.json') }));
  expect(await createNvdSource(cfg()).match({ cpe: CPE }, deps(fetchFn))).toMatchObject({ ok: false, reason: 'Parse' });
});

describe('timeout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  test('hung request -> Timeout', async () => {
    const { fetchFn } = fakeFetch(() => ({ hang: true }));
    const p = createNvdSource(cfg()).match({ cpe: CPE }, deps(fetchFn));
    await vi.advanceTimersByTimeAsync(1000);
    expect(await p).toMatchObject({ ok: false, reason: 'Timeout' });
  });
});
