import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb } from '../../src/db/client';
import { buildApp } from '../../src/app';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Absolute migrations dir, independent of process cwd (per spec caveat). */
export const MIGRATIONS_DIR = path.resolve(here, '../../migrations');
export const TEST_ORG_ID = '00000000-0000-0000-0000-000000000001';

export function makeTestApp() {
  const handle = createDb({ url: ':memory:', migrationsDir: MIGRATIONS_DIR });
  const app = buildApp({ db: handle.db, defaultOrgId: TEST_ORG_ID });
  return { app, handle, defaultOrgId: TEST_ORG_ID };
}
