import { afterEach, beforeEach, expect, test } from 'vitest';
import { createDb, type DbHandle } from '../src/db/client';
import * as apiKeyRepo from '../src/repository/apiKeys';
import { generateToken, hashToken, verifyTokenHash } from '../src/auth/tokens';
import { MIGRATIONS_DIR, TEST_ORG_ID } from './helpers/app';

let handle: DbHandle;
beforeEach(() => {
  handle = createDb({ url: ':memory:', migrationsDir: MIGRATIONS_DIR });
});
afterEach(() => {
  handle.close();
});

test('api keys: create / findByKeyId / disable + token verify', () => {
  const secret = generateToken();
  const created = apiKeyRepo.create(handle.db, {
    keyId: 'abc123',
    orgId: TEST_ORG_ID,
    label: 'ci-runner',
    tokenHash: hashToken(secret),
    createdBy: 'system',
  });
  expect(created.disabled).toBe(0);
  expect(created.lastUsedAt).toBeNull();

  const found = apiKeyRepo.findByKeyId(handle.db, 'abc123');
  expect(found).toBeDefined();
  expect(verifyTokenHash(secret, found!.tokenHash)).toBe(true);
  expect(verifyTokenHash('wrong-secret', found!.tokenHash)).toBe(false);

  apiKeyRepo.setDisabled(handle.db, 'abc123', true);
  expect(apiKeyRepo.findByKeyId(handle.db, 'abc123')?.disabled).toBe(1);
});
