import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { runMigrations } from './migrate';

export type AppDb = BetterSQLite3Database<typeof schema>;

export interface DbHandle {
  db: AppDb;
  sqlite: Database.Database;
  close: () => void;
}

export interface CreateDbOptions {
  url: string;
  migrationsDir: string;
}

/** Opens better-sqlite3, wraps with drizzle, applies migrations. */
export function createDb({ url, migrationsDir }: CreateDbOptions): DbHandle {
  const file = toSqlitePath(url);
  if (file !== ':memory:') {
    mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  }
  const sqlite = new Database(file);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  runMigrations(db, migrationsDir);
  return { db, sqlite, close: () => { sqlite.close(); } };
}

/** "file:./rap.db" -> "./rap.db"; ":memory:" passes through. */
function toSqlitePath(url: string): string {
  if (url === ':memory:') return ':memory:';
  const stripped = url.startsWith('file:') ? url.slice(5) : url;
  return stripped === ':memory:' ? ':memory:' : stripped;
}
