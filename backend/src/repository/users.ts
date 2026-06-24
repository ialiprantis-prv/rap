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
    createdAt: now,
    updatedAt: now,
  };
  db.insert(users).values(row).run();
  return row;
}

/** Sets a new password hash and clears the must-change flag. */
export function setPassword(db: AppDb, orgId: string, id: string, passwordHash: string): void {
  db.update(users)
    .set({ passwordHash, mustChangePassword: 0, updatedAt: Date.now() })
    .where(and(eq(users.orgId, orgId), eq(users.id, id)))
    .run();
}

export function setDisabled(db: AppDb, orgId: string, id: string, disabled: boolean): void {
  db.update(users)
    .set({ disabled: disabled ? 1 : 0, updatedAt: Date.now() })
    .where(and(eq(users.orgId, orgId), eq(users.id, id)))
    .run();
}

/** Global user count, across orgs — used by the first-boot seed gate. */
export function count(db: AppDb): number {
  const row = db.select({ n: sql<number>`count(*)` }).from(users).get();
  return row?.n ?? 0;
}
