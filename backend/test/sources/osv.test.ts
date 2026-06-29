import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createOsvSource, type OsvConfig } from '../../src/sources/osv';
import type { FetchFn } from '../../src/sources/types';
import { fakeFetch } from '../helpers/sources';

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = (name: string): unknown => JSON.parse(readFileSync(path.resolve(here, '../fixtures/sources/osv', name), 'utf8'));

const cfg = (over: Partial<OsvConfig> = {}): OsvConfig => ({
  baseUrl: 'https://osv.test',
  timeoutMs: 1000,
  retries: 0,
  rateMax: 100,
  rateWindowMs: 1000,
  ...over,
});
const deps = (fetchFn: FetchFn) => ({ fetchFn, now: () => Date.now() });
const body = (calls: { init?: RequestInit }[], i = 0): Record<string, unknown> => JSON.parse(calls[i].init?.body as string);

test('versioned purl -> {package:{purl}}, no version field', async () => {
  const { fetchFn, calls } = fakeFetch(() => ({ body: fx('empty.json') }));
  await createOsvSource(cfg()).match({ purl: 'pkg:npm/foo@1.2.3', version: '1.2.3' }, deps(fetchFn));
  expect(calls[0].url).toBe('https://osv.test/v1/query');
  expect(body(calls)).toEqual({ package: { purl: 'pkg:npm/foo@1.2.3' } });
});

test('unversioned purl + version -> {package:{purl},version}', async () => {
  const { fetchFn, calls } = fakeFetch(() => ({ body: fx('empty.json') }));
  await createOsvSource(cfg()).match({ purl: 'pkg:npm/foo', version: '2.0.0' }, deps(fetchFn));
  expect(body(calls)).toEqual({ package: { purl: 'pkg:npm/foo' }, version: '2.0.0' });
});

test('unversioned purl + no version -> skip (no call)', async () => {
  const { fetchFn, calls } = fakeFetch(() => ({ body: fx('empty.json') }));
  expect(await createOsvSource(cfg()).match({ purl: 'pkg:npm/foo' }, deps(fetchFn))).toEqual({ ok: true, cveIds: [] });
  expect(calls.length).toBe(0);
});

test('no purl -> skip (no call)', async () => {
  const { fetchFn, calls } = fakeFetch(() => ({ body: fx('empty.json') }));
  expect(await createOsvSource(cfg()).match({ cpe: 'cpe:2.3:a:x:y:1' }, deps(fetchFn))).toEqual({ ok: true, cveIds: [] });
  expect(calls.length).toBe(0);
});

test('aliases -> CVE: single + multiple; GHSA-only dropped; severity captured', async () => {
  const { fetchFn } = fakeFetch(() => ({ body: fx('full.json') }));
  const r = await createOsvSource(cfg()).match({ purl: 'pkg:npm/foo@1.0.0' }, deps(fetchFn));
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.cveIds).toEqual(['CVE-2023-1111', 'CVE-2024-2222', 'CVE-2024-3333']); // GHSA-only record dropped
    expect(r.cveData?.get('CVE-2023-1111')?.cvssVector).toContain('CVSS:3.1/');
    expect(r.cveData?.get('CVE-2024-3333')?.cvssVector).toContain('CVSS:3.1/');
  }
});

test('empty result -> ok, no cveIds', async () => {
  const { fetchFn } = fakeFetch(() => ({ body: fx('empty.json') }));
  expect(await createOsvSource(cfg()).match({ purl: 'pkg:npm/foo@1.0.0' }, deps(fetchFn))).toEqual({ ok: true, cveIds: [], cveData: new Map() });
});

test('pagination follows next_page_token', async () => {
  const { fetchFn, calls } = fakeFetch(({ call }) =>
    call === 0
      ? { body: { vulns: [{ id: 'GHSA-1', aliases: ['CVE-2020-0001'] }], next_page_token: 'PAGE2' } }
      : { body: { vulns: [{ id: 'GHSA-2', aliases: ['CVE-2020-0002'] }] } },
  );
  const r = await createOsvSource(cfg()).match({ purl: 'pkg:npm/foo@1.0.0' }, deps(fetchFn));
  expect(calls.length).toBe(2);
  expect(body(calls, 1).page_token).toBe('PAGE2');
  if (r.ok) expect(r.cveIds).toEqual(['CVE-2020-0001', 'CVE-2020-0002']);
});

test('429 -> RateLimited; 5xx -> Http; malformed -> Parse', async () => {
  const purl = { purl: 'pkg:npm/foo@1.0.0' };
  const r429 = fakeFetch(() => ({ status: 429, headers: { 'retry-after': '1' } }));
  expect(await createOsvSource(cfg()).match(purl, deps(r429.fetchFn))).toMatchObject({ ok: false, reason: 'RateLimited' });
  const r5xx = fakeFetch(() => ({ status: 502, body: {} }));
  expect(await createOsvSource(cfg()).match(purl, deps(r5xx.fetchFn))).toMatchObject({ ok: false, reason: 'Http' });
  const rBad = fakeFetch(() => ({ body: fx('error.json') }));
  expect(await createOsvSource(cfg()).match(purl, deps(rBad.fetchFn))).toMatchObject({ ok: false, reason: 'Parse' });
});

describe('timeout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  test('hung request -> Timeout', async () => {
    const { fetchFn } = fakeFetch(() => ({ hang: true }));
    const p = createOsvSource(cfg()).match({ purl: 'pkg:npm/foo@1.0.0' }, deps(fetchFn));
    await vi.advanceTimersByTimeAsync(1000);
    expect(await p).toMatchObject({ ok: false, reason: 'Timeout' });
  });
});
