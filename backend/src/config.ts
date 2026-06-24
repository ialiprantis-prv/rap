import path from 'node:path';
import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().min(1).default('0.0.0.0'),
  DATABASE_URL: z.string().min(1).default('file:./rap.db'),
  DEFAULT_ORG_ID: z.string().min(1).default('00000000-0000-0000-0000-000000000001'),
  MIGRATIONS_DIR: z.string().min(1).default(path.resolve(process.cwd(), 'migrations')),
  // Cookie signing secret. REQUIRED, no default (fail closed). Generate with
  // `openssl rand -base64 48`.
  COOKIE_SECRET: z.string().min(32),
  // Plain z.coerce.boolean treats "false" as true; parse the literal instead.
  COOKIE_SECURE: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  COOKIE_NAME: z.string().min(1).default('rap_session'),
  SESSION_ABSOLUTE_TTL_MS: z.coerce.number().int().positive().default(28800000), // 8h
  SESSION_IDLE_TTL_MS: z.coerce.number().int().positive().default(3600000), // 1h
  RAP_ADMIN_USERNAME: z.string().min(1).optional(),
  RAP_ADMIN_PASSWORD: z.string().min(12).optional(),
});

export interface Config {
  port: number;
  host: string;
  databaseUrl: string;
  defaultOrgId: string;
  migrationsDir: string;
  cookieSecret: string;
  cookieSecure: boolean;
  cookieName: string;
  sessionAbsoluteTtlMs: number;
  sessionIdleTtlMs: number;
  adminUsername?: string;
  adminPassword?: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.parse(env);
  return {
    port: parsed.PORT,
    host: parsed.HOST,
    databaseUrl: parsed.DATABASE_URL,
    defaultOrgId: parsed.DEFAULT_ORG_ID,
    migrationsDir: parsed.MIGRATIONS_DIR,
    cookieSecret: parsed.COOKIE_SECRET,
    cookieSecure: parsed.COOKIE_SECURE,
    cookieName: parsed.COOKIE_NAME,
    sessionAbsoluteTtlMs: parsed.SESSION_ABSOLUTE_TTL_MS,
    sessionIdleTtlMs: parsed.SESSION_IDLE_TTL_MS,
    adminUsername: parsed.RAP_ADMIN_USERNAME,
    adminPassword: parsed.RAP_ADMIN_PASSWORD,
  };
}
