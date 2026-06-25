import { eq } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { apiKeys } from '../db/schema';
import type { ApiKey, Role } from '../db/schema';

export interface CreateApiKeyInput {
  keyId: string;
  orgId: string;
  label: string;
  role: Role;
  tokenHash: string;
  createdBy: string;
}

export function create(db: AppDb, input: CreateApiKeyInput): ApiKey {
  const row: ApiKey = {
    keyId: input.keyId,
    orgId: input.orgId,
    label: input.label,
    role: input.role,
    tokenHash: input.tokenHash,
    createdBy: input.createdBy,
    disabled: 0,
    createdAt: Date.now(),
    lastUsedAt: null,
  };
  db.insert(apiKeys).values(row).run();
  return row;
}

export function findByKeyId(db: AppDb, keyId: string): ApiKey | undefined {
  return db.select().from(apiKeys).where(eq(apiKeys.keyId, keyId)).get();
}

export function listKeys(db: AppDb, orgId: string): ApiKey[] {
  return db.select().from(apiKeys).where(eq(apiKeys.orgId, orgId)).all();
}

export function setDisabled(db: AppDb, keyId: string, disabled: boolean): void {
  db.update(apiKeys).set({ disabled: disabled ? 1 : 0 }).where(eq(apiKeys.keyId, keyId)).run();
}

export function touchLastUsed(db: AppDb, keyId: string, ts: number): void {
  db.update(apiKeys).set({ lastUsedAt: ts }).where(eq(apiKeys.keyId, keyId)).run();
}
