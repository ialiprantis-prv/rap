import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
