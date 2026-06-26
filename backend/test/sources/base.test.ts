import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { computeBackoff, httpGetJson, parseRetryAfter } from '../../src/sources/base';
import { RateLimiter } from '../../src/sources/rateLimit';
import type { FetchFn } from '../../src/sources/types';
import { fakeFetch } from '../helpers/sources';

const deps = (fetchFn: FetchFn) => ({ fetchFn, now: () => Date.now() });

test('rate limiter spaces calls to max per window', () => {
  const rl = new RateLimiter(2, 1000);
  expect(rl.reserve(0)).toBe(0);
  expect(rl.reserve(0)).toBe(0);
  expect(rl.reserve(0)).toBe(1000); // 3rd waits a full window
  expect(rl.reserve(0)).toBe(1000); // 4th rides the same freed window
  expect(rl.reserve(0)).toBe(2000); // 5th waits two windows
});

test('computeBackoff stays within [0, cap] and never below Retry-After', () => {
  const opts = { timeoutMs: 1, retries: 0, backoffBaseMs: 100, backoffMaxMs: 1000 };
  for (let attempt = 0; attempt < 6; attempt++) {
    const cap = Math.min(1000, 100 * 2 ** attempt);
    for (let i = 0; i < 50; i++) {
      const d = computeBackoff(attempt, undefined, opts);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(cap);
    }
  }
  expect(computeBackoff(0, 5000, opts)).toBeGreaterThanOrEqual(5000);
});

test('parseRetryAfter handles delta-seconds, dates, and junk', () => {
  expect(parseRetryAfter('2')).toBe(2000);
  expect(parseRetryAfter(null)).toBe(0);
  expect(parseRetryAfter('garbage')).toBe(0);
  const now = 1_000_000;
  expect(parseRetryAfter(new Date(now + 3000).toUTCString(), now)).toBeGreaterThanOrEqual(2000);
});

test('4xx is a non-retriable Http failure', async () => {
  const { fetchFn, calls } = fakeFetch(() => ({ status: 404, body: {} }));
  const r = await httpGetJson('http://x', { timeoutMs: 1000, retries: 3 }, deps(fetchFn));
  expect(r).toEqual({ ok: false, reason: 'Http', status: 404 });
  expect(calls.length).toBe(1);
});

describe('with fake timers', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test('aborts after timeoutMs -> Timeout', async () => {
    const { fetchFn } = fakeFetch(() => ({ hang: true }));
    const p = httpGetJson('http://x', { timeoutMs: 1000, retries: 0 }, deps(fetchFn));
    await vi.advanceTimersByTimeAsync(1000);
    expect(await p).toEqual({ ok: false, reason: 'Timeout' });
  });

  test('retries a 500 then succeeds', async () => {
    const { fetchFn, calls } = fakeFetch(({ call }) =>
      call === 0 ? { status: 500, body: {} } : { status: 200, body: { ok: 1 } },
    );
    const p = httpGetJson('http://x', { timeoutMs: 1000, retries: 3, backoffBaseMs: 10, backoffMaxMs: 50 }, deps(fetchFn));
    await vi.advanceTimersByTimeAsync(200);
    const r = await p;
    expect(r.ok).toBe(true);
    expect(calls.length).toBe(2);
  });
});
