import type { FastifyInstance } from 'fastify';
import type { AppDb } from '../db/client';
import type { Role } from '../db/schema';
import * as sessionRepo from '../repository/sessions';
import * as userRepo from '../repository/users';
import { hashToken } from './tokens';

/** The authenticated principal attached to a request (no secrets). */
export interface AuthUser {
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
 * route). Resolving the user LIVE per request means disable / role changes
 * take effect immediately. Must be applied AFTER @fastify/cookie has loaded
 * so request.cookies / unsignCookie are available.
 */
export function applyAuth(app: FastifyInstance, deps: AuthHookDeps): void {
  app.addHook('onRequest', async (request) => {
    const raw = request.cookies[deps.cookieName];
    if (!raw) return;
    const unsigned = request.unsignCookie(raw);
    if (!unsigned.valid || unsigned.value === null) return;

    const session = sessionRepo.findByTokenHash(deps.db, hashToken(unsigned.value));
    if (!session) return;

    const now = Date.now();
    if (now >= session.expiresAt || now - session.lastSeenAt > deps.sessionIdleTtlMs) {
      sessionRepo.deleteByTokenHash(deps.db, session.tokenHash);
      return;
    }

    const user = userRepo.getById(deps.db, session.orgId, session.userId);
    if (!user || user.disabled) return;

    sessionRepo.touch(deps.db, session.tokenHash, now);
    request.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      orgId: user.orgId,
      mustChangePassword: user.mustChangePassword === 1,
    };
  });
}
