// @rap/backend — service entrypoint (C3a). Parses config, opens the DB (runs
// migrations), seeds the first admin (fail-closed), builds the Fastify app,
// listens, and shuts down gracefully.
import { loadConfig } from './config';
import { createDb, type DbHandle } from './db/client';
import { seedAdmin } from './auth/seed';
import { buildApp } from './app';

function log(level: 'info' | 'error', msg: string): void {
  console.log(JSON.stringify({ level, msg, ts: Date.now() }));
}

async function start(): Promise<void> {
  const config = loadConfig();
  let handle: DbHandle;
  try {
    handle = createDb({ url: config.databaseUrl, migrationsDir: config.migrationsDir });
    await seedAdmin(handle.db, config);
  } catch (err) {
    log('error', `startup failed: ${String(err)}`);
    process.exit(1);
  }

  const app = buildApp({
    db: handle.db,
    defaultOrgId: config.defaultOrgId,
    cookieSecret: config.cookieSecret,
    cookieName: config.cookieName,
    cookieSecure: config.cookieSecure,
    sessionAbsoluteTtlMs: config.sessionAbsoluteTtlMs,
    sessionIdleTtlMs: config.sessionIdleTtlMs,
  });

  let shuttingDown = false;
  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    log('info', `received ${signal}, shutting down`);
    try {
      await app.close();
    } finally {
      handle.close();
      process.exit(0);
    }
  }
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ port: config.port, host: config.host });
  log('info', `listening on http://${config.host}:${config.port}`);
}

start().catch((err: unknown) => {
  log('error', `fatal: ${String(err)}`);
  process.exit(1);
});
