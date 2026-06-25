import type { FastifyPluginAsync } from 'fastify';
import { RISK_SCALE_MAX } from '@rap/engine';

/** Engine touchpoint: proves the bundle resolves @rap/engine. Public (no auth). */
export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', { config: { public: true } }, async () => ({
    ok: true,
    engine: { riskScaleMax: RISK_SCALE_MAX },
  }));
};
