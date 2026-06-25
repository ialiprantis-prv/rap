import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppDb } from '../db/client';
import type { Role } from '../db/schema';
import * as apiKeyRepo from '../repository/apiKeys';
import * as sessionRepo from '../repository/sessions';
import * as userRepo from '../repository/users';
import { hashToken, parseApiKey, verifyTokenHash } from './tokens';

/** The authenticated principal attached to a request (no secrets). */
export interface AuthUser {
  kind: 'session' | 'apikey';
  id: string;
  username: string;
  role: Role;
  orgId: string;
  mustChangePassword: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export interface AuthHookDeps {
  db: AppDb;
  cookieName: string;
  sessionIdleTtlMs: number;
}

/**
 * Installs the request authenticator on the root instance (runs for every
 * route). Tries the session cookie first, then an X-API-Key header. Resolving
 * the principal LIVE per request means disable / role changes take effect
 * immediately. Must be applied AFTER @fastify/cookie has loaded.
 */
export function applyAuth(app: FastifyInstance, deps: AuthHookDeps): void {
  app.addHook('onRequest', async (request) => {
    request.user = resolveSession(deps, request) ?? resolveApiKey(deps, request);
  });
}

function resolveSession(deps: AuthHookDeps, request: FastifyRequest): AuthUser | undefined {
  const raw = request.cookies[deps.cookieName];
  if (!raw) return undefined;
  const unsigned = request.unsignCookie(raw);
  if (!unsigned.valid || unsigned.value === null) return undefined;

  const session = sessionRepo.findByTokenHash(deps.db, hashToken(unsigned.value));
  if (!session) return undefined;

  const now = Date.now();
  if (now >= session.expiresAt || now - session.lastSeenAt > deps.sessionIdleTtlMs) {
    sessionRepo.deleteByTokenHash(deps.db, session.tokenHash);
    return undefined;
  }

  const user = userRepo.getById(deps.db, session.orgId, session.userId);
  if (!user || user.disabled) return undefined;

  sessionRepo.touch(deps.db, session.tokenHash, now);
  return {
    kind: 'session',
    id: user.id,
    username: user.username,
    role: user.role,
    orgId: user.orgId,
    mustChangePassword: user.mustChangePassword === 1,
  };
}

function resolveApiKey(deps: AuthHookDeps, request: FastifyRequest): AuthUser | undefined {
  const header = request.headers['x-api-key'];
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return undefined;
  const parsed = parseApiKey(raw);
  if (!parsed) return undefined;

  const key = apiKeyRepo.findByKeyId(deps.db, parsed.keyId);
  if (!key || key.disabled) return undefined;
  if (!verifyTokenHash(parsed.secret, key.tokenHash)) return undefined;

  apiKeyRepo.touchLastUsed(deps.db, key.keyId, Date.now());
  return {
    kind: 'apikey',
    id: key.keyId,
    username: key.label || key.keyId,
    role: key.role,
    orgId: key.orgId,
    mustChangePassword: false,
  };
}
