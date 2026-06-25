import type { FastifyPluginAsync } from 'fastify';
import type { AppDeps } from '../app';

/**
 * Read-only view of the license verified at startup. Held in app state — this
 * route does NOT re-verify per request. Admin-gated.
 */
export const licenseRoutes: FastifyPluginAsync<AppDeps> = async (app, opts) => {
  const adminCfg = { config: { requiredRole: 'org_admin' as const } };
  app.get('/license', adminCfg, async () => opts.license);
};
