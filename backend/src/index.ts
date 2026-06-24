// @rap/backend — service entrypoint (C2). Parses config, opens the DB (runs
// migrations), builds the Fastify app, listens, and shuts down gracefully.
import { loadConfig } from './config';
import { createDb } from './db/client';
import { buildApp } from './app';

function log(level: 'info' | 'error', msg: string): void {
  console.log(JSON.stringify({ level, msg, ts: Date.now() }));
}

const config = loadConfig();
const handle = createDb({ url: config.databaseUrl, migrationsDir: config.migrationsDir });
const app = buildApp({ db: handle.db, defaultOrgId: config.defaultOrgId });

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

try {
  await app.listen({ port: config.port, host: config.host });
  log('info', `listening on http://${config.host}:${config.port}`);
} catch (err) {
  log('error', `failed to start: ${String(err)}`);
  handle.close();
  process.exit(1);
}
