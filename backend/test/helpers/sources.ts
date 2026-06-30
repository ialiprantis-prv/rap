import type { DbHandle } from '../../src/db/client';
import { vulnMatchEdge, vulnSourceCve, vulnSourceMatch } from '../../src/db/schema';
import type { CveData, FetchFn, IdentityKind, SourceId, SourceResult, VulnEnrichSource, VulnMatchSource } from '../../src/sources/types';
import { TEST_ORG_ID } from './app';

/** Constant clock. */
export function fixedClock(ms: number): () => number {
  return () => ms;
}

export interface FakeResponse {
  status?: number;
  body?: unknown;
  parseError?: boolean;
  headers?: Record<string, string>;
  rejectName?: string; // reject with an Error of this name (e.g. 'TypeError')
  hang?: boolean; // never resolve until the AbortController fires
}

export type FakeHandler = (ctx: { url: string; init?: RequestInit; call: number }) => FakeResponse;

/** A fetch stand-in driven by a handler; records every call. */
export function fakeFetch(handler: FakeHandler): { fetchFn: FetchFn; calls: { url: string; init?: RequestInit }[] } {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchFn = ((input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const call = calls.length;
    calls.push({ url, ...(init ? { init } : {}) });
    const r = handler({ url, init, call });
    if (r.hang) {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const e = new Error('aborted');
          e.name = 'AbortError';
          reject(e);
        });
      });
    }
    if (r.rejectName) {
      const e = new Error('fetch failed');
      e.name = r.rejectName;
      return Promise.reject(e);
    }
    const res = {
      status: r.status ?? 200,
      headers: { get: (k: string) => headerGet(r.headers, k) },
      json: () => (r.parseError ? Promise.reject(new Error('bad json')) : Promise.resolve(r.body)),
    };
    return Promise.resolve(res as unknown as Response);
  }) as FetchFn;
  return { fetchFn, calls };
}

function headerGet(headers: Record<string, string> | undefined, key: string): string | null {
  if (!headers) return null;
  const lk = key.toLowerCase();
  for (const [k, v] of Object.entries(headers)) if (k.toLowerCase() === lk) return v;
  return null;
}

/** A controllable match source for resolve tests; tracks call count. */
export function stubMatchSource(
  id: SourceId,
  identityKind: IdentityKind,
  impl: () => SourceResult,
): VulnMatchSource & { calls: number } {
  const s = {
    id,
    identityKind,
    calls: 0,
    match() {
      s.calls++;
      return Promise.resolve(impl());
    },
  };
  return s;
}

/** A controllable enrich source for enrich-service tests; records the CVE ids it was asked for. */
export function stubEnrichSource(id: SourceId, impl: (cveIds: string[]) => SourceResult): VulnEnrichSource & { calls: number; lastCveIds: string[] } {
  const s = {
    id,
    calls: 0,
    lastCveIds: [] as string[],
    enrich(cveIds: string[]) {
      s.calls++;
      s.lastCveIds = cveIds;
      return Promise.resolve(impl(cveIds));
    },
  };
  return s;
}

export interface SeedHeaderInput {
  source?: SourceId;
  identityKind?: IdentityKind;
  identityValue: string;
  fetchedAt?: number | null;
  expiresAt?: number | null;
  lastAttemptAt?: number;
  lastStatus?: 'ok' | 'error';
  lastError?: string | null;
}

export function seedMatchHeader(handle: DbHandle, input: SeedHeaderInput): void {
  handle.db
    .insert(vulnSourceMatch)
    .values({
      orgId: TEST_ORG_ID,
      source: input.source ?? 'nvd',
      identityKind: input.identityKind ?? 'cpe',
      identityValue: input.identityValue,
      fetchedAt: input.fetchedAt ?? null,
      expiresAt: input.expiresAt ?? null,
      lastAttemptAt: input.lastAttemptAt ?? input.fetchedAt ?? 0,
      lastStatus: input.lastStatus ?? 'ok',
      lastError: input.lastError ?? null,
    })
    .run();
}

export function seedEdges(handle: DbHandle, identityValue: string, cveIds: string[], source: SourceId = 'nvd', identityKind: IdentityKind = 'cpe'): void {
  if (cveIds.length === 0) return;
  handle.db
    .insert(vulnMatchEdge)
    .values(cveIds.map((cveId) => ({ orgId: TEST_ORG_ID, source, identityKind, identityValue, cveId })))
    .run();
}

export function seedCveEnrich(handle: DbHandle, cveId: string, cvss: number, source: SourceId = 'nvd'): void {
  handle.db
    .insert(vulnSourceCve)
    .values({ orgId: TEST_ORG_ID, source, cveId, payload: { cvss }, fetchedAt: 0, expiresAt: 1, lastAttemptAt: 0, lastStatus: 'ok', lastError: null })
    .run();
}

export interface SeedCveRowInput {
  source: SourceId;
  cveId: string;
  payload?: CveData | null;
  fetchedAt?: number | null;
  expiresAt?: number | null;
  lastAttemptAt?: number;
  lastStatus?: 'ok' | 'error';
  lastError?: string | null;
}

/** Seed a vuln_source_cve row with explicit freshness, for enrich-service tests. */
export function seedCveRow(handle: DbHandle, input: SeedCveRowInput): void {
  handle.db
    .insert(vulnSourceCve)
    .values({
      orgId: TEST_ORG_ID,
      source: input.source,
      cveId: input.cveId,
      payload: input.payload ?? null,
      fetchedAt: input.fetchedAt ?? null,
      expiresAt: input.expiresAt ?? null,
      lastAttemptAt: input.lastAttemptAt ?? input.fetchedAt ?? 0,
      lastStatus: input.lastStatus ?? 'ok',
      lastError: input.lastError ?? null,
    })
    .run();
}
