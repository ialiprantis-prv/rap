import { afterAll, beforeAll, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authedAgent, makeTestApp, TEST_ORG_ID } from './helpers/app';

let app: FastifyInstance;
let close: () => void;
let cookie: string; // an analyst — can read and write

beforeAll(async () => {
  const t = makeTestApp();
  app = t.app;
  close = t.handle.close;
  const agent = await authedAgent(app, t.handle, {
    username: 'ana',
    password: 'analyst-pass-1',
    role: 'analyst',
  });
  cookie = agent.cookie;
});

afterAll(async () => {
  await app.close();
  close();
});

test('assessment CRUD lifecycle (analyst)', async () => {
  // create
  const created = await app.inject({
    method: 'POST',
    url: '/assessments',
    headers: { cookie },
    payload: { name: 'First', description: 'desc' },
  });
  expect(created.statusCode).toBe(201);
  const rec = created.json();
  expect(rec.id).toBeTypeOf('string');
  expect(rec.orgId).toBe(TEST_ORG_ID);
  expect(rec.status).toBe('draft');

  // list
  const listed = await app.inject({ method: 'GET', url: '/assessments', headers: { cookie } });
  expect(listed.statusCode).toBe(200);
  expect(listed.json()).toHaveLength(1);

  // get
  const got = await app.inject({ method: 'GET', url: `/assessments/${rec.id}`, headers: { cookie } });
  expect(got.statusCode).toBe(200);
  expect(got.json().name).toBe('First');

  // patch
  const patched = await app.inject({
    method: 'PATCH',
    url: `/assessments/${rec.id}`,
    headers: { cookie },
    payload: { name: 'Renamed', status: 'active' },
  });
  expect(patched.statusCode).toBe(200);
  expect(patched.json().name).toBe('Renamed');
  expect(patched.json().status).toBe('active');

  // delete -> 204, then get -> 404
  const deleted = await app.inject({ method: 'DELETE', url: `/assessments/${rec.id}`, headers: { cookie } });
  expect(deleted.statusCode).toBe(204);
  const gone = await app.inject({ method: 'GET', url: `/assessments/${rec.id}`, headers: { cookie } });
  expect(gone.statusCode).toBe(404);
});

test('bad create body -> 400', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/assessments',
    headers: { cookie },
    payload: { name: '' },
  });
  expect(res.statusCode).toBe(400);
  expect(res.json().error).toBe('ValidationError');
});

test('unauthenticated assessment access -> 401', async () => {
  const res = await app.inject({ method: 'GET', url: '/assessments' });
  expect(res.statusCode).toBe(401);
});
