import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { users } from '../db/schema';
import type { Role, User } from '../db/schema';

export interface CreateUserInput {
  username: string;
  passwordHash: string;
  role: Role;
  mustChangePassword?: boolean;
}

export interface LockoutConfig {
  maxAttempts: number;
  lockBaseMs: number;
  lockMaxMs: number;
}

export function findByUsername(db: AppDb, orgId: string, username: string): User | undefined {
  return db
    .select()
    .from(users)
    .where(and(eq(users.orgId, orgId), eq(users.username, username)))
    .get();
}

export function getById(db: AppDb, orgId: string, id: string): User | undefined {
  return db
    .select()
    .from(users)
    .where(and(eq(users.orgId, orgId), eq(users.id, id)))
    .get();
}

export function listUsers(db: AppDb, orgId: string): User[] {
  return db.select().from(users).where(eq(users.orgId, orgId)).all();
}

export function create(db: AppDb, orgId: string, input: CreateUserInput): User {
  const now = Date.now();
  const row: User = {
    id: randomUUID(),
    orgId,
    username: input.username,
    passwordHash: input.passwordHash,
    role: input.role,
    mustChangePassword: input.mustChangePassword ? 1 : 0,
    disabled: 0,
    failedAttempts: 0,
    lockedUntil: null,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(users).values(row).run();
  return row;
}

/** Sets a new password hash and clears the must-change flag (self-service). */
export function setPassword(db: AppDb, orgId: string, id: string, passwordHash: string): void {
  db.update(users)
    .set({ passwordHash, mustChangePassword: 0, updatedAt: Date.now() })
    .where(and(eq(users.orgId, orgId), eq(users.id, id)))
    .run();
}

/** Admin reset: sets a new hash and FORCES a change at next login. */
export function setPasswordMustChange(db: AppDb, orgId: string, id: string, passwordHash: string): void {
  db.update(users)
    .set({ passwordHash, mustChangePassword: 1, updatedAt: Date.now() })
    .where(and(eq(users.orgId, orgId), eq(users.id, id)))
    .run();
}

export function setRole(db: AppDb, orgId: string, id: string, role: Role): void {
  db.update(users)
    .set({ role, updatedAt: Date.now() })
    .where(and(eq(users.orgId, orgId), eq(users.id, id)))
    .run();
}

export function setDisabled(db: AppDb, orgId: string, id: string, disabled: boolean): void {
  db.update(users)
    .set({ disabled: disabled ? 1 : 0, updatedAt: Date.now() })
    .where(and(eq(users.orgId, orgId), eq(users.id, id)))
    .run();
}

export function isLocked(user: User, now: number): boolean {
  return user.lockedUntil !== null && user.lockedUntil > now;
}

/**
 * Increments the failed-login counter; once attempts >= maxAttempts the account
 * locks with exponential backoff capped at lockMaxMs.
 */
export function recordFailedLogin(db: AppDb, user: User, cfg: LockoutConfig, now: number): void {
  const attempts = user.failedAttempts + 1;
  let lockedUntil = user.lockedUntil;
  if (attempts >= cfg.maxAttempts) {
    const backoff = Math.min(cfg.lockMaxMs, cfg.lockBaseMs * 2 ** (attempts - cfg.maxAttempts));
    lockedUntil = now + backoff;
  }
  db.update(users)
    .set({ failedAttempts: attempts, lockedUntil, updatedAt: now })
    .where(and(eq(users.orgId, user.orgId), eq(users.id, user.id)))
    .run();
}

export function resetLockout(db: AppDb, orgId: string, id: string): void {
  db.update(users)
    .set({ failedAttempts: 0, lockedUntil: null, updatedAt: Date.now() })
    .where(and(eq(users.orgId, orgId), eq(users.id, id)))
    .run();
}

/** Global user count, across orgs — used by the first-boot seed gate. */
export function count(db: AppDb): number {
  const row = db.select({ n: sql<number>`count(*)` }).from(users).get();
  return row?.n ?? 0;
}
