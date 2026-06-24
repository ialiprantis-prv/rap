import type { FastifyPluginAsync } from 'fastify';
import { RISK_SCALE_MAX } from '@rap/engine';

/** Engine touchpoint: proves the bundle resolves @rap/engine. */
export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => ({ ok: true, engine: { riskScaleMax: RISK_SCALE_MAX } }));
};
