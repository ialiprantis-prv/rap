import { afterEach, beforeEach, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { DbHandle } from '../src/db/client';
import { authedAgent, makeTestApp } from './helpers/app';

let app: FastifyInstance;
let handle: DbHandle;

beforeEach(() => {
  const t = makeTestApp();
  app = t.app;
  handle = t.handle;
  // A deliberately untagged route to prove deny-by-default.
  app.get('/untagged', async () => ({ ok: true }));
});
afterEach(async () => {
  await app.close();
  handle.close();
});

test('protected route without a principal -> 401', async () => {
  expect((await app.inject({ method: 'GET', url: '/assessments' })).statusCode).toBe(401);
});

test('viewer hitting an analyst route -> 403; analyst -> 200', async () => {
  const viewer = await authedAgent(app, handle, { username: 'v', password: 'viewer-pass-1', role: 'viewer' });
  const w = await app.inject({ method: 'POST', url: '/assessments', headers: { cookie: viewer.cookie }, payload: { name: 'x' } });
  expect(w.statusCode).toBe(403);
  expect(w.json().error).toBe('Forbidden');

  const analyst = await authedAgent(app, handle, { username: 'a', password: 'analyst-pass-1', role: 'analyst' });
  const ok = await app.inject({ method: 'POST', url: '/assessments', headers: { cookie: analyst.cookie }, payload: { name: 'x' } });
  expect(ok.statusCode).toBe(201);
});

test('viewer CAN read an assessment route -> 200', async () => {
  const viewer = await authedAgent(app, handle, { username: 'v', password: 'viewer-pass-1', role: 'viewer' });
  expect((await app.inject({ method: 'GET', url: '/assessments', headers: { cookie: viewer.cookie } })).statusCode).toBe(200);
});

test('deny-by-default: an untagged route -> 403 even for an admin', async () => {
  const admin = await authedAgent(app, handle, { username: 'adm', password: 'admin-pass-12', role: 'org_admin' });
  const res = await app.inject({ method: 'GET', url: '/untagged', headers: { cookie: admin.cookie } });
  expect(res.statusCode).toBe(403);
  expect(res.json().error).toBe('RouteMisconfigured');
});

test('must_change user: assessments 403 PasswordChangeRequired; /me + /me/password allowed; restored after change', async () => {
  const agent = await authedAgent(app, handle, {
    username: 'fresh',
    password: 'first-pass-123',
    role: 'analyst',
    mustChangePassword: true,
  });

  const blocked = await app.inject({ method: 'GET', url: '/assessments', headers: { cookie: agent.cookie } });
  expect(blocked.statusCode).toBe(403);
  expect(blocked.json().error).toBe('PasswordChangeRequired');

  expect((await app.inject({ method: 'GET', url: '/me', headers: { cookie: agent.cookie } })).statusCode).toBe(200);

  const changed = await app.inject({
    method: 'POST',
    url: '/me/password',
    headers: { cookie: agent.cookie },
    payload: { currentPassword: 'first-pass-123', newPassword: 'second-pass-456' },
  });
  expect(changed.statusCode).toBe(200);

  // The current session keeps working and access is restored immediately.
  expect((await app.inject({ method: 'GET', url: '/assessments', headers: { cookie: agent.cookie } })).statusCode).toBe(200);
});
