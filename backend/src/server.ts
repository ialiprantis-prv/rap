// Shared server bootstrap, parameterised by the license verification key so the
// prod entry (src/index.ts) and the dev entry (src/dev/index.ts) can inject
// different keys WITHOUT any runtime env switch. Parses config, opens the DB
// (runs migrations), seeds the first admin, verifies the license (fail-closed),
// builds the Fastify app, listens, and shuts down gracefully.
import type { KeyObject } from 'node:crypto';
import { loadConfig } from './config';
import { createDb } from './db/client';
import { seedAdmin } from './auth/seed';
import { loadAndVerifyLicense } from './license/startup';
import { buildApp } from './app';

export interface StartOptions {
  licensePublicKey: KeyObject;
}

function log(level: 'info' | 'error', msg: string): void {
  console.log(JSON.stringify({ level, msg, ts: Date.now() }));
}

export async function startServer(opts: StartOptions): Promise<void> {
  let closeDb: (() => void) | undefined;
  try {
    const config = loadConfig();
    const handle = createDb({ url: config.databaseUrl, migrationsDir: config.migrationsDir });
    closeDb = handle.close;
    await seedAdmin(handle.db, config);

    // Fail-closed license gate: exits the process on any failure (no bind).
    const license = loadAndVerifyLicense({ filePath: config.licenseFile, publicKey: opts.licensePublicKey, log });

    const app = buildApp({
      db: handle.db,
      defaultOrgId: config.defaultOrgId,
      cookieSecret: config.cookieSecret,
      cookieName: config.cookieName,
      cookieSecure: config.cookieSecure,
      sessionAbsoluteTtlMs: config.sessionAbsoluteTtlMs,
      sessionIdleTtlMs: config.sessionIdleTtlMs,
      loginMaxAttempts: config.loginMaxAttempts,
      loginLockBaseMs: config.loginLockBaseMs,
      loginLockMaxMs: config.loginLockMaxMs,
      license,
    });

    let shuttingDown = false;
    const shutdown = async (signal: string): Promise<void> => {
      if (shuttingDown) return;
      shuttingDown = true;
      log('info', `received ${signal}, shutting down`);
      try {
        await app.close();
      } finally {
        handle.close();
        process.exit(0);
      }
    };
    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));

    await app.listen({ port: config.port, host: config.host });
    log('info', `listening on http://${config.host}:${config.port}`);
  } catch (err) {
    log('error', `startup failed: ${String(err)}`);
    if (closeDb) closeDb();
    process.exit(1);
  }
}
