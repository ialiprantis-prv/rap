import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app';
import * as repo from '../repository/assessments';

const CreateBody = z.object({
  name: z.string().min(1),
  description: z.string().nullish(),
});

const PatchBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullish(),
  status: z.string().min(1).optional(),
});

const Params = z.object({ id: z.string().min(1) });

export const assessmentRoutes: FastifyPluginAsync<AppDeps> = async (app, opts) => {
  const { db, defaultOrgId } = opts;

  app.post('/assessments', async (req, reply) => {
    const body = CreateBody.parse(req.body);
    const rec = repo.create(db, defaultOrgId, {
      name: body.name,
      description: body.description ?? null,
    });
    return reply.status(201).send(rec);
  });

  app.get('/assessments', async () => repo.list(db, defaultOrgId));

  app.get('/assessments/:id', async (req, reply) => {
    const { id } = Params.parse(req.params);
    const rec = repo.get(db, defaultOrgId, id);
    if (!rec) return reply.status(404).send({ error: 'NotFound' });
    return rec;
  });

  app.patch('/assessments/:id', async (req, reply) => {
    const { id } = Params.parse(req.params);
    const patch = PatchBody.parse(req.body);
    const rec = repo.update(db, defaultOrgId, id, patch);
    if (!rec) return reply.status(404).send({ error: 'NotFound' });
    return rec;
  });

  app.delete('/assessments/:id', async (req, reply) => {
    const { id } = Params.parse(req.params);
    const ok = repo.remove(db, defaultOrgId, id);
    if (!ok) return reply.status(404).send({ error: 'NotFound' });
    return reply.status(204).send();
  });
};
