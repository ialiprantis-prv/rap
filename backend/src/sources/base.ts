// Shared HTTP base for source clients. Injectable fetchFn + now (testing).
// Never throws to callers: every failure maps to { ok:false, reason }. Applies
// an AbortController timeout, a rolling rate limiter, and bounded exponential
// backoff with full jitter, honoring Retry-After on 429.
import type { FetchFn, SourceDeps, SourceFailureReason } from './types';
import type { RateLimiter } from './rateLimit';

export type HttpResult =
  | { ok: true; status: number; body: unknown }
  | { ok: false; reason: SourceFailureReason; status?: number };

export interface HttpOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs: number;
  retries: number;
  limiter?: RateLimiter;
  backoffBaseMs?: number;
  backoffMaxMs?: number;
}

const DEFAULT_BACKOFF_BASE_MS = 500;
const DEFAULT_BACKOFF_MAX_MS = 8000;

export function httpGetJson(url: string, opts: HttpOptions, deps: SourceDeps): Promise<HttpResult> {
  return httpJson(url, { ...opts, method: 'GET' }, deps);
}

export function httpPostJson(url: string, opts: HttpOptions, deps: SourceDeps): Promise<HttpResult> {
  return httpJson(url, { ...opts, method: 'POST' }, deps);
}

async function httpJson(url: string, opts: HttpOptions, deps: SourceDeps): Promise<HttpResult> {
  for (let attempt = 0; ; attempt++) {
    if (opts.limiter) {
      const wait = opts.limiter.reserve(deps.now());
      if (wait > 0) await sleep(wait);
    }
    const { res, retryAfterMs } = await tryOnce(url, opts, deps.fetchFn);
    if (res.ok) return res;
    if (!isRetriable(res) || attempt >= opts.retries) return res;
    await sleep(computeBackoff(attempt, retryAfterMs, opts));
  }
}

async function tryOnce(
  url: string,
  opts: HttpOptions,
  fetchFn: FetchFn,
): Promise<{ res: HttpResult; retryAfterMs?: number }> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), opts.timeoutMs);
  try {
    const r = await fetchFn(url, { method: opts.method, headers: opts.headers, body: opts.body, signal: ac.signal });
    if (r.status === 429) {
      return { res: { ok: false, reason: 'RateLimited', status: 429 }, retryAfterMs: parseRetryAfter(r.headers.get('retry-after')) };
    }
    if (r.status >= 400) return { res: { ok: false, reason: 'Http', status: r.status } };
    try {
      return { res: { ok: true, status: r.status, body: await r.json() } };
    } catch {
      return { res: { ok: false, reason: 'Parse', status: r.status } };
    }
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    return { res: { ok: false, reason: name === 'AbortError' ? 'Timeout' : 'Network' } };
  } finally {
    clearTimeout(timer);
  }
}

function isRetriable(res: Extract<HttpResult, { ok: false }>): boolean {
  if (res.reason === 'Timeout' || res.reason === 'Network' || res.reason === 'RateLimited') return true;
  return res.reason === 'Http' && res.status !== undefined && res.status >= 500;
}

/** Full-jitter exponential backoff, capped, never below Retry-After. */
export function computeBackoff(attempt: number, retryAfterMs: number | undefined, opts: HttpOptions): number {
  const base = opts.backoffBaseMs ?? DEFAULT_BACKOFF_BASE_MS;
  const max = opts.backoffMaxMs ?? DEFAULT_BACKOFF_MAX_MS;
  const cap = Math.min(max, base * 2 ** attempt);
  const jittered = Math.random() * cap;
  return Math.max(jittered, retryAfterMs ?? 0);
}

/** Retry-After as delta-seconds or HTTP-date -> ms (0 if absent/unparseable). */
export function parseRetryAfter(header: string | null, now: number = Date.now()): number {
  if (!header) return 0;
  const secs = Number(header);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const when = Date.parse(header);
  return Number.isNaN(when) ? 0 : Math.max(0, when - now);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
