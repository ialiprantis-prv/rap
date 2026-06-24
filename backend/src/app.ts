import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import type { AppDb } from './db/client';
import { healthRoutes } from './routes/health';
import { assessmentRoutes } from './routes/assessments';

export interface AppDeps {
  db: AppDb;
  defaultOrgId: string;
}

/** Builds a Fastify instance. No DB work here — db is injected. */
export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: false });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.status(400).send({ error: 'ValidationError', issues: err.issues });
    }
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 404) {
      return reply.status(404).send({ error: 'NotFound' });
    }
    return reply.status(500).send({ error: 'InternalServerError' });
  });

  app.register(healthRoutes);
  app.register(assessmentRoutes, deps);
  return app;
}
