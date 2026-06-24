import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Assessments. org_id is stamped on EVERY row (single-tenant today,
 * multi-tenant-ready). Timestamps are integer epoch-ms.
 */
export const assessments = sqliteTable(
  'assessments',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status').notNull().default('draft'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [index('idx_assessments_org_id').on(t.orgId)],
);

export type Assessment = typeof assessments.$inferSelect;
export type NewAssessment = typeof assessments.$inferInsert;

/** Local accounts. Booleans are stored as 0/1 integers. */
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role', {
      enum: ['prv_super_admin', 'org_admin', 'analyst', 'viewer'],
    }).notNull(),
    mustChangePassword: integer('must_change_password').notNull().default(0),
    disabled: integer('disabled').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [uniqueIndex('uq_users_org_username').on(t.orgId, t.username)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Role = User['role'];

/** Server-side sessions. Token is stored HASHED; cascade-deleted with the user. */
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    createdAt: integer('created_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
    lastSeenAt: integer('last_seen_at').notNull(),
  },
  (t) => [
    uniqueIndex('uq_sessions_token_hash').on(t.tokenHash),
    index('idx_sessions_user_id').on(t.userId),
  ],
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

/** API keys. key_id is the public prefix; the secret is stored only as a hash. */
export const apiKeys = sqliteTable('api_keys', {
  keyId: text('key_id').primaryKey(),
  orgId: text('org_id').notNull(),
  label: text('label').notNull(),
  tokenHash: text('token_hash').notNull(),
  createdBy: text('created_by').notNull(),
  disabled: integer('disabled').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  lastUsedAt: integer('last_used_at'),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
