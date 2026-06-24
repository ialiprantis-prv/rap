import { afterEach, beforeEach, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { sessions } from '../src/db/schema';
import type { DbHandle } from '../src/db/client';
import { setDisabled } from '../src/repository/users';
import { login, makeTestApp, seedUser, TEST_COOKIE_NAME } from './helpers/app';

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

test('login: good credentials -> 200 + Set-Cookie', async () => {
  await seedUser(handle, { username: 'ana', password: 'analyst-pass-1', role: 'analyst' });
  const res = await app.inject({ method: 'POST', url: '/login', payload: { username: 'ana', password: 'analyst-pass-1' } });
  expect(res.statusCode).toBe(200);
  expect(res.json().user).toMatchObject({ username: 'ana', role: 'analyst', mustChangePassword: false });
  expect(res.cookies.find((c) => c.name === TEST_COOKIE_NAME)).toBeDefined();
});

test('login: bad password / unknown / disabled -> 401', async () => {
  await seedUser(handle, { username: 'ana', password: 'analyst-pass-1', role: 'analyst' });
  const bad = await app.inject({ method: 'POST', url: '/login', payload: { username: 'ana', password: 'nope' } });
  expect(bad.statusCode).toBe(401);
  expect(bad.json().error).toBe('InvalidCredentials');

  const unknown = await app.inject({ method: 'POST', url: '/login', payload: { username: 'ghost', password: 'whatever12' } });
  expect(unknown.statusCode).toBe(401);

  const disabled = await seedUser(handle, { username: 'old', password: 'old-pass-1234', role: 'viewer' });
  setDisabled(handle.db, disabled.orgId, disabled.id, true);
  const dres = await app.inject({ method: 'POST', url: '/login', payload: { username: 'old', password: 'old-pass-1234' } });
  expect(dres.statusCode).toBe(401);
});

test('session: login -> /me 200; logout -> /me 401', async () => {
  await seedUser(handle, { username: 'ana', password: 'analyst-pass-1', role: 'analyst' });
  const cookie = await login(app, 'ana', 'analyst-pass-1');

  const me = await app.inject({ method: 'GET', url: '/me', headers: { cookie } });
  expect(me.statusCode).toBe(200);
  expect(me.json().user.username).toBe('ana');

  const out = await app.inject({ method: 'POST', url: '/logout', headers: { cookie } });
  expect(out.statusCode).toBe(200);

  const after = await app.inject({ method: 'GET', url: '/me', headers: { cookie } });
  expect(after.statusCode).toBe(401);
});

test('/me without a cookie -> 401', async () => {
  const res = await app.inject({ method: 'GET', url: '/me' });
  expect(res.statusCode).toBe(401);
  expect(res.json().error).toBe('Unauthorized');
});

test('session: absolute-expired and idle-expired both -> 401', async () => {
  const u = await seedUser(handle, { username: 'ana', password: 'analyst-pass-1', role: 'analyst' });

  // absolute expiry
  const cookie1 = await login(app, 'ana', 'analyst-pass-1');
  handle.db.update(sessions).set({ expiresAt: Date.now() - 1000 }).where(eq(sessions.userId, u.id)).run();
  expect((await app.inject({ method: 'GET', url: '/me', headers: { cookie: cookie1 } })).statusCode).toBe(401);

  // idle expiry (still within absolute window, but last_seen too old)
  const cookie2 = await login(app, 'ana', 'analyst-pass-1');
  handle.db.update(sessions).set({ lastSeenAt: Date.now() - 7200000 }).where(eq(sessions.userId, u.id)).run();
  expect((await app.inject({ method: 'GET', url: '/me', headers: { cookie: cookie2 } })).statusCode).toBe(401);
});

test('password change: wrong current -> 401; good -> rotates, clears must-change, revokes others', async () => {
  await seedUser(handle, { username: 'ana', password: 'analyst-pass-1', role: 'analyst', mustChangePassword: true });
  const cookieA = await login(app, 'ana', 'analyst-pass-1');
  const cookieB = await login(app, 'ana', 'analyst-pass-1');

  const wrong = await app.inject({
    method: 'POST',
    url: '/me/password',
    headers: { cookie: cookieA },
    payload: { currentPassword: 'nope', newPassword: 'brand-new-pass-1' },
  });
  expect(wrong.statusCode).toBe(401);

  const ok = await app.inject({
    method: 'POST',
    url: '/me/password',
    headers: { cookie: cookieA },
    payload: { currentPassword: 'analyst-pass-1', newPassword: 'brand-new-pass-1' },
  });
  expect(ok.statusCode).toBe(200);

  // current session kept, other session revoked
  expect((await app.inject({ method: 'GET', url: '/me', headers: { cookie: cookieA } })).statusCode).toBe(200);
  expect((await app.inject({ method: 'GET', url: '/me', headers: { cookie: cookieB } })).statusCode).toBe(401);

  // must-change cleared after re-login with the new password
  const fresh = await login(app, 'ana', 'brand-new-pass-1');
  const me = await app.inject({ method: 'GET', url: '/me', headers: { cookie: fresh } });
  expect(me.json().user.mustChangePassword).toBe(false);
});
