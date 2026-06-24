import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

/** Thin wrapper over the drizzle better-sqlite3 migrator. */
export function runMigrations<TSchema extends Record<string, unknown>>(
  db: BetterSQLite3Database<TSchema>,
  migrationsDir: string,
): void {
  migrate(db, { migrationsFolder: migrationsDir });
}
