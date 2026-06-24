import { afterEach, beforeEach, expect, test } from 'vitest';
import type { Config } from '../src/config';
import { createDb, type DbHandle } from '../src/db/client';
import { seedAdmin } from '../src/auth/seed';
import { AuthBootstrapError } from '../src/auth/errors';
import * as userRepo from '../src/repository/users';
import { MIGRATIONS_DIR, TEST_ORG_ID } from './helpers/app';

let handle: DbHandle;
beforeEach(() => {
  handle = createDb({ url: ':memory:', migrationsDir: MIGRATIONS_DIR });
});
afterEach(() => {
  handle.close();
});

function cfg(admin?: { username?: string; password?: string }): Config {
  return {
    port: 8080,
    host: '0.0.0.0',
    databaseUrl: ':memory:',
    defaultOrgId: TEST_ORG_ID,
    migrationsDir: MIGRATIONS_DIR,
    cookieSecret: 'x'.repeat(32),
    cookieSecure: false,
    cookieName: 'rap_session',
    sessionAbsoluteTtlMs: 28800000,
    sessionIdleTtlMs: 3600000,
    adminUsername: admin?.username,
    adminPassword: admin?.password,
  };
}

test('seed: empty db + no env -> throws (fail closed)', async () => {
  await expect(seedAdmin(handle.db, cfg())).rejects.toBeInstanceOf(AuthBootstrapError);
  expect(userRepo.count(handle.db)).toBe(0);
});

test('seed: empty db + env -> creates super-admin (must_change=1); idempotent', async () => {
  const c = cfg({ username: 'root', password: 'supersecret123' });
  await seedAdmin(handle.db, c);
  const u = userRepo.findByUsername(handle.db, TEST_ORG_ID, 'root');
  expect(u?.role).toBe('prv_super_admin');
  expect(u?.mustChangePassword).toBe(1);
  expect(u?.disabled).toBe(0);

  await seedAdmin(handle.db, c); // run twice
  expect(userRepo.count(handle.db)).toBe(1);
});
