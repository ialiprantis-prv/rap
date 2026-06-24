import cookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import type { AppDb } from './db/client';
import { AuthError } from './auth/errors';
import { applyAuth } from './auth/plugin';
import { healthRoutes } from './routes/health';
import { assessmentRoutes } from './routes/assessments';
import { authRoutes } from './routes/auth';

export interface AppDeps {
  db: AppDb;
  defaultOrgId: string;
  cookieSecret: string;
  cookieName: string;
  cookieSecure: boolean;
  sessionAbsoluteTtlMs: number;
  sessionIdleTtlMs: number;
}

/** Builds a Fastify instance. No DB work here — db is injected. */
export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: false });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.status(400).send({ error: 'ValidationError', issues: err.issues });
    }
    if (err instanceof AuthError) {
      return reply.status(401).send({ error: err.code });
    }
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 404) {
      return reply.status(404).send({ error: 'NotFound' });
    }
    return reply.status(500).send({ error: 'InternalServerError' });
  });

  // Register cookie first, then install the authenticator AFTER it has loaded
  // so the auth hook runs after cookie parsing (request.cookies available).
  app.register(cookie, { secret: deps.cookieSecret }).after(() => {
    applyAuth(app, {
      db: deps.db,
      cookieName: deps.cookieName,
      sessionIdleTtlMs: deps.sessionIdleTtlMs,
    });
  });

  app.register(healthRoutes);
  app.register(assessmentRoutes, deps);
  app.register(authRoutes, deps);
  return app;
}
