import { randomUUID } from 'node:crypto';
import { and, eq, ne } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { sessions } from '../db/schema';
import type { Session } from '../db/schema';

export interface CreateSessionInput {
  orgId: string;
  userId: string;
  tokenHash: string;
  expiresAt: number;
}

export function create(db: AppDb, input: CreateSessionInput): Session {
  const now = Date.now();
  const row: Session = {
    id: randomUUID(),
    orgId: input.orgId,
    userId: input.userId,
    tokenHash: input.tokenHash,
    createdAt: now,
    expiresAt: input.expiresAt,
    lastSeenAt: now,
  };
  db.insert(sessions).values(row).run();
  return row;
}

export function findByTokenHash(db: AppDb, tokenHash: string): Session | undefined {
  return db.select().from(sessions).where(eq(sessions.tokenHash, tokenHash)).get();
}

export function touch(db: AppDb, tokenHash: string, lastSeenAt: number): void {
  db.update(sessions).set({ lastSeenAt }).where(eq(sessions.tokenHash, tokenHash)).run();
}

export function deleteByTokenHash(db: AppDb, tokenHash: string): void {
  db.delete(sessions).where(eq(sessions.tokenHash, tokenHash)).run();
}

/** Bulk revoke all of a user's sessions except the one to keep. */
export function deleteOthersForUser(db: AppDb, userId: string, keepTokenHash: string): void {
  db.delete(sessions)
    .where(and(eq(sessions.userId, userId), ne(sessions.tokenHash, keepTokenHash)))
    .run();
}

export function deleteForUser(db: AppDb, userId: string): void {
  db.delete(sessions).where(eq(sessions.userId, userId)).run();
}
