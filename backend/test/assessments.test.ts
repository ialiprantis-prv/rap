import { afterAll, beforeAll, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { makeTestApp, TEST_ORG_ID } from './helpers/app';

let app: FastifyInstance;
let close: () => void;

beforeAll(() => {
  const t = makeTestApp();
  app = t.app;
  close = t.handle.close;
});

afterAll(async () => {
  await app.close();
  close();
});

test('assessment CRUD lifecycle', async () => {
  // create
  const created = await app.inject({
    method: 'POST',
    url: '/assessments',
    payload: { name: 'First', description: 'desc' },
  });
  expect(created.statusCode).toBe(201);
  const rec = created.json();
  expect(rec.id).toBeTypeOf('string');
  expect(rec.orgId).toBe(TEST_ORG_ID);
  expect(rec.status).toBe('draft');

  // list
  const listed = await app.inject({ method: 'GET', url: '/assessments' });
  expect(listed.statusCode).toBe(200);
  expect(listed.json()).toHaveLength(1);

  // get
  const got = await app.inject({ method: 'GET', url: `/assessments/${rec.id}` });
  expect(got.statusCode).toBe(200);
  expect(got.json().name).toBe('First');

  // patch
  const patched = await app.inject({
    method: 'PATCH',
    url: `/assessments/${rec.id}`,
    payload: { name: 'Renamed', status: 'active' },
  });
  expect(patched.statusCode).toBe(200);
  expect(patched.json().name).toBe('Renamed');
  expect(patched.json().status).toBe('active');

  // delete -> 204, then get -> 404
  const deleted = await app.inject({ method: 'DELETE', url: `/assessments/${rec.id}` });
  expect(deleted.statusCode).toBe(204);
  const gone = await app.inject({ method: 'GET', url: `/assessments/${rec.id}` });
  expect(gone.statusCode).toBe(404);
});

test('bad create body -> 400', async () => {
  const res = await app.inject({ method: 'POST', url: '/assessments', payload: { name: '' } });
  expect(res.statusCode).toBe(400);
  expect(res.json().error).toBe('ValidationError');
});
