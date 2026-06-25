import { afterEach, beforeEach, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { DbHandle } from '../src/db/client';
import { resetLockout } from '../src/repository/users';
import { makeTestApp, seedUser, TEST_ORG_ID } from './helpers/app';

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

function attempt(password: string) {
  return app.inject({ method: 'POST', url: '/login', payload: { username: 'u', password } });
}

test('lockout: MAX bad logins locks the account; correct password still 401 while locked; reset restores', async () => {
  const user = await seedUser(handle, { username: 'u', password: 'good-pass-1234', role: 'analyst' });

  // 5 failures (LOGIN_MAX_ATTEMPTS) -> locked
  for (let i = 0; i < 5; i++) {
    expect((await attempt('wrong')).statusCode).toBe(401);
  }

  // correct password is refused while locked
  expect((await attempt('good-pass-1234')).statusCode).toBe(401);

  // simulate the lock window passing / an admin unlock
  resetLockout(handle.db, TEST_ORG_ID, user.id);
  expect((await attempt('good-pass-1234')).statusCode).toBe(200);
});

test('lockout: a success before the threshold resets the failure counter', async () => {
  await seedUser(handle, { username: 'u', password: 'good-pass-1234', role: 'analyst' });
  expect((await attempt('wrong')).statusCode).toBe(401);
  expect((await attempt('wrong')).statusCode).toBe(401);
  expect((await attempt('good-pass-1234')).statusCode).toBe(200); // resets counter
  // counter cleared: a fresh failure does not immediately lock
  expect((await attempt('wrong')).statusCode).toBe(401);
  expect((await attempt('good-pass-1234')).statusCode).toBe(200);
});
