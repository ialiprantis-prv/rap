import type { FastifyInstance } from 'fastify';
import type { Role } from '../db/schema';
import { AuthError, ForbiddenError } from './errors';
import { meetsRequirement } from './roles';

declare module 'fastify' {
  interface FastifyContextConfig {
    public?: boolean;
    requiredRole?: Role;
  }
}

// Routes a must-change-password user may still reach (besides public routes).
const MUST_CHANGE_ALLOW = new Set(['/me', '/me/password', '/logout']);

/**
 * Global authorization guard (preHandler — always runs after the onRequest
 * authenticator). DENY-BY-DEFAULT: a defined route tagged with neither
 * `public` nor `requiredRole` is refused (403) and logged as a misconfig.
 */
export function applyGuard(app: FastifyInstance): void {
  app.addHook('preHandler', async (request) => {
    const cfg = request.routeOptions.config ?? {};
    if (cfg.public === true) return;

    if (cfg.requiredRole === undefined) {
      request.log.warn(
        { method: request.method, url: request.routeOptions.url },
        'route missing auth policy (public/requiredRole) — denied by default',
      );
      throw new ForbiddenError('RouteMisconfigured');
    }

    const user = request.user;
    if (!user) throw new AuthError();

    if (user.mustChangePassword && !MUST_CHANGE_ALLOW.has(request.routeOptions.url ?? '')) {
      throw new ForbiddenError('PasswordChangeRequired');
    }

    if (!meetsRequirement(user.role, cfg.requiredRole)) {
      throw new ForbiddenError('Forbidden');
    }
  });
}
