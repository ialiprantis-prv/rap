import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { createDb, type DbHandle } from '../../src/db/client';
import { buildApp } from '../../src/app';
import type { Role } from '../../src/db/schema';
import { hashPassword } from '../../src/auth/password';
import * as userRepo from '../../src/repository/users';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Absolute migrations dir, independent of process cwd (per spec caveat). */
export const MIGRATIONS_DIR = path.resolve(here, '../../migrations');
export const TEST_ORG_ID = '00000000-0000-0000-0000-000000000001';
export const TEST_COOKIE_SECRET = 'test-cookie-secret-at-least-32-chars-xx';
export const TEST_COOKIE_NAME = 'rap_session';

export function makeTestApp() {
  const handle = createDb({ url: ':memory:', migrationsDir: MIGRATIONS_DIR });
  const app = buildApp({
    db: handle.db,
    defaultOrgId: TEST_ORG_ID,
    cookieSecret: TEST_COOKIE_SECRET,
    cookieName: TEST_COOKIE_NAME,
    cookieSecure: false,
    sessionAbsoluteTtlMs: 28800000,
    sessionIdleTtlMs: 3600000,
  });
  return { app, handle, defaultOrgId: TEST_ORG_ID };
}

export interface SeedUserInput {
  username: string;
  password: string;
  role: Role;
  mustChangePassword?: boolean;
}

export async function seedUser(handle: DbHandle, input: SeedUserInput) {
  const passwordHash = await hashPassword(input.password);
  return userRepo.create(handle.db, TEST_ORG_ID, {
    username: input.username,
    passwordHash,
    role: input.role,
    mustChangePassword: input.mustChangePassword ?? false,
  });
}

/** Logs in and returns the `name=value` Cookie header to replay on later calls. */
export async function login(app: FastifyInstance, username: string, password: string): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/login', payload: { username, password } });
  const c = res.cookies.find((x) => x.name === TEST_COOKIE_NAME);
  if (!c) throw new Error(`login failed (${res.statusCode}): ${res.payload}`);
  return `${c.name}=${c.value}`;
}
