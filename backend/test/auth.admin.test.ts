import { afterEach, beforeEach, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { DbHandle } from '../src/db/client';
import { authedAgent, login, makeTestApp, seedUser } from './helpers/app';

let app: FastifyInstance;
let handle: DbHandle;
let adminCookie: string;

beforeEach(async () => {
  const t = makeTestApp();
  app = t.app;
  handle = t.handle;
  adminCookie = (await authedAgent(app, handle, { username: 'adm', password: 'admin-pass-12', role: 'org_admin' })).cookie;
});
afterEach(async () => {
  await app.close();
  handle.close();
});

function issueKey(cookie: string, body: { label: string; role: string }) {
  return app.inject({ method: 'POST', url: '/api-keys', headers: { cookie }, payload: body });
}

test('api-key: admin issues -> usable as X-API-Key on a viewer route; revoke -> 401', async () => {
  const issued = await issueKey(adminCookie, { label: 'ci', role: 'viewer' });
  expect(issued.statusCode).toBe(201);
  const { key, keyId } = issued.json();
  expect(key.startsWith('rap_')).toBe(true);

  const used = await app.inject({ method: 'GET', url: '/assessments', headers: { 'x-api-key': key } });
  expect(used.statusCode).toBe(200);

  // revoke
  expect((await app.inject({ method: 'DELETE', url: `/api-keys/${keyId}`, headers: { cookie: adminCookie } })).statusCode).toBe(204);
  expect((await app.inject({ method: 'GET', url: '/assessments', headers: { 'x-api-key': key } })).statusCode).toBe(401);
});

test('api-key: malformed -> 401', async () => {
  const res = await app.inject({ method: 'GET', url: '/assessments', headers: { 'x-api-key': 'garbage' } });
  expect(res.statusCode).toBe(401);
});

test('api-key: analyst cannot issue (admin-only) -> 403', async () => {
  const analyst = await authedAgent(app, handle, { username: 'a', password: 'analyst-pass-1', role: 'analyst' });
  const res = await issueKey(analyst.cookie, { label: 'x', role: 'viewer' });
  expect(res.statusCode).toBe(403);
});

test('api-key: org_admin cannot issue a prv_super_admin key -> 403', async () => {
  const res = await issueKey(adminCookie, { label: 'super', role: 'prv_super_admin' });
  expect(res.statusCode).toBe(403);
});

test('users: admin-created analyst can write assessments (after first password change)', async () => {
  const created = await app.inject({
    method: 'POST',
    url: '/users',
    headers: { cookie: adminCookie },
    payload: { username: 'newana', password: 'temp-pass-1234', role: 'analyst' },
  });
  expect(created.statusCode).toBe(201);
  expect(created.json().mustChangePassword).toBe(true);

  const cookie = await login(app, 'newana', 'temp-pass-1234');
  // blocked until password change
  expect((await app.inject({ method: 'POST', url: '/assessments', headers: { cookie }, payload: { name: 'x' } })).statusCode).toBe(403);
  await app.inject({ method: 'POST', url: '/me/password', headers: { cookie }, payload: { currentPassword: 'temp-pass-1234', newPassword: 'real-pass-12345' } });
  const write = await app.inject({ method: 'POST', url: '/assessments', headers: { cookie }, payload: { name: 'x' } });
  expect(write.statusCode).toBe(201);
});

test('users: org_admin creating a prv_super_admin -> 403', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/users',
    headers: { cookie: adminCookie },
    payload: { username: 'super', password: 'temp-pass-1234', role: 'prv_super_admin' },
  });
  expect(res.statusCode).toBe(403);
});

test('users: disabling a user kills their active sessions', async () => {
  const victim = await authedAgent(app, handle, { username: 'vic', password: 'victim-pass-1', role: 'analyst' });
  expect((await app.inject({ method: 'GET', url: '/me', headers: { cookie: victim.cookie } })).statusCode).toBe(200);

  const patched = await app.inject({
    method: 'PATCH',
    url: `/users/${victim.user.id}`,
    headers: { cookie: adminCookie },
    payload: { disabled: true },
  });
  expect(patched.statusCode).toBe(200);
  expect((await app.inject({ method: 'GET', url: '/me', headers: { cookie: victim.cookie } })).statusCode).toBe(401);
});

test('hierarchy: org_admin cannot act on a prv_super_admin target (role / disable / reset) -> 403', async () => {
  const target = await seedUser(handle, { username: 'super', password: 'super-pass-123', role: 'prv_super_admin' });

  const demote = await app.inject({
    method: 'PATCH',
    url: `/users/${target.id}`,
    headers: { cookie: adminCookie },
    payload: { role: 'analyst' },
  });
  expect(demote.statusCode).toBe(403);

  const disable = await app.inject({
    method: 'PATCH',
    url: `/users/${target.id}`,
    headers: { cookie: adminCookie },
    payload: { disabled: true },
  });
  expect(disable.statusCode).toBe(403);

  const reset = await app.inject({
    method: 'POST',
    url: `/users/${target.id}/reset-password`,
    headers: { cookie: adminCookie },
    payload: { newPassword: 'brand-new-pass-1' },
  });
  expect(reset.statusCode).toBe(403);
});

test('hierarchy: prv_super_admin acting on an org_admin (role change + disable) -> 200', async () => {
  const superAgent = await authedAgent(app, handle, { username: 'root', password: 'root-pass-1234', role: 'prv_super_admin' });
  const target = await seedUser(handle, { username: 'orgadm', password: 'org-pass-1234', role: 'org_admin' });

  const res = await app.inject({
    method: 'PATCH',
    url: `/users/${target.id}`,
    headers: { cookie: superAgent.cookie },
    payload: { role: 'analyst', disabled: true },
  });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toMatchObject({ role: 'analyst', disabled: true });
});

test('hierarchy: org_admin acting on an analyst (lower rank) -> 200', async () => {
  const target = await seedUser(handle, { username: 'ana', password: 'analyst-pass-1', role: 'analyst' });
  const res = await app.inject({
    method: 'PATCH',
    url: `/users/${target.id}`,
    headers: { cookie: adminCookie },
    payload: { disabled: true },
  });
  expect(res.statusCode).toBe(200);
  expect(res.json().disabled).toBe(true);
});
