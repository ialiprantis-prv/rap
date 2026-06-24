import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { assessments } from '../db/schema';
import type { Assessment } from '../db/schema';

export interface CreateAssessmentInput {
  name: string;
  description?: string | null;
}

export interface UpdateAssessmentPatch {
  name?: string;
  description?: string | null;
  status?: string;
}

export function create(db: AppDb, orgId: string, input: CreateAssessmentInput): Assessment {
  const now = Date.now();
  const row: Assessment = {
    id: randomUUID(),
    orgId,
    name: input.name,
    description: input.description ?? null,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
  db.insert(assessments).values(row).run();
  return row;
}

export function list(db: AppDb, orgId: string): Assessment[] {
  return db.select().from(assessments).where(eq(assessments.orgId, orgId)).all();
}

export function get(db: AppDb, orgId: string, id: string): Assessment | undefined {
  return db
    .select()
    .from(assessments)
    .where(and(eq(assessments.orgId, orgId), eq(assessments.id, id)))
    .get();
}

export function update(
  db: AppDb,
  orgId: string,
  id: string,
  patch: UpdateAssessmentPatch,
): Assessment | undefined {
  const fields: Partial<Assessment> = { updatedAt: Date.now() };
  if (patch.name !== undefined) fields.name = patch.name;
  if (patch.description !== undefined) fields.description = patch.description;
  if (patch.status !== undefined) fields.status = patch.status;
  return db
    .update(assessments)
    .set(fields)
    .where(and(eq(assessments.orgId, orgId), eq(assessments.id, id)))
    .returning()
    .get();
}

export function remove(db: AppDb, orgId: string, id: string): boolean {
  const res = db
    .delete(assessments)
    .where(and(eq(assessments.orgId, orgId), eq(assessments.id, id)))
    .run();
  return res.changes > 0;
}
