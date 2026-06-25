import { afterEach, beforeEach, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { DbHandle } from '../src/db/client';
import { authedAgent, makeTestApp, TEST_LICENSE } from './helpers/app';

let app: FastifyInstance;
let handle: DbHandle;

beforeEach(() => {
  const t = makeTestApp();
  app = t.app;
  handle = t.handle;
});
afterEach(async () => {
  await app.close();
  handle.close();
});

test('GET /license returns the startup-verified summary to an admin', async () => {
  const admin = await authedAgent(app, handle, { username: 'adm', password: 'admin-pass-12', role: 'org_admin' });
  const res = await app.inject({ method: 'GET', url: '/license', headers: { cookie: admin.cookie } });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual(TEST_LICENSE);
});

test('GET /license is forbidden for a viewer -> 403', async () => {
  const viewer = await authedAgent(app, handle, { username: 'v', password: 'viewer-pass-1', role: 'viewer' });
  const res = await app.inject({ method: 'GET', url: '/license', headers: { cookie: viewer.cookie } });
  expect(res.statusCode).toBe(403);
});

test('GET /license unauthenticated -> 401', async () => {
  expect((await app.inject({ method: 'GET', url: '/license' })).statusCode).toBe(401);
});
