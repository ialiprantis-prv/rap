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
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCK_BASE_MS: z.coerce.number().int().positive().default(60000), // 1m
  LOGIN_LOCK_MAX_MS: z.coerce.number().int().positive().default(900000), // 15m
  RAP_LICENSE_FILE: z.string().min(1).default('/etc/rap/license.json'),
  // Vulnerability sources (C4a). NVD_API_KEY is a server-side secret (never logged).
  NVD_API_KEY: z.string().min(1).optional(),
  NVD_BASE_URL: z.string().min(1).default('https://services.nvd.nist.gov/rest/json/cves/2.0'),
  RAP_SOURCES_OFFLINE: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  RAP_SOURCE_NVD_ENABLED: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  NVD_RATE_MAX: z.coerce.number().int().positive().default(5), // 50 with an API key
  NVD_RATE_WINDOW_MS: z.coerce.number().int().positive().default(30000),
  SOURCE_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  SOURCE_HTTP_RETRIES: z.coerce.number().int().nonnegative().default(3),
  VULN_CACHE_TTL_NVD_MS: z.coerce.number().int().positive().default(86400000), // 24h
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
  loginMaxAttempts: number;
  loginLockBaseMs: number;
  loginLockMaxMs: number;
  licenseFile: string;
  nvdApiKey?: string;
  nvdBaseUrl: string;
  sourcesOffline: boolean;
  sourceNvdEnabled: boolean;
  nvdRateMax: number;
  nvdRateWindowMs: number;
  sourceHttpTimeoutMs: number;
  sourceHttpRetries: number;
  vulnCacheTtlNvdMs: number;
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
    loginMaxAttempts: parsed.LOGIN_MAX_ATTEMPTS,
    loginLockBaseMs: parsed.LOGIN_LOCK_BASE_MS,
    loginLockMaxMs: parsed.LOGIN_LOCK_MAX_MS,
    licenseFile: parsed.RAP_LICENSE_FILE,
    nvdApiKey: parsed.NVD_API_KEY,
    nvdBaseUrl: parsed.NVD_BASE_URL,
    sourcesOffline: parsed.RAP_SOURCES_OFFLINE,
    sourceNvdEnabled: parsed.RAP_SOURCE_NVD_ENABLED,
    nvdRateMax: parsed.NVD_RATE_MAX,
    nvdRateWindowMs: parsed.NVD_RATE_WINDOW_MS,
    sourceHttpTimeoutMs: parsed.SOURCE_HTTP_TIMEOUT_MS,
    sourceHttpRetries: parsed.SOURCE_HTTP_RETRIES,
    vulnCacheTtlNvdMs: parsed.VULN_CACHE_TTL_NVD_MS,
  };
}
