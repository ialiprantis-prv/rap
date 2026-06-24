import path from 'node:path';
import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().min(1).default('0.0.0.0'),
  DATABASE_URL: z.string().min(1).default('file:./rap.db'),
  DEFAULT_ORG_ID: z.string().min(1).default('00000000-0000-0000-0000-000000000001'),
  MIGRATIONS_DIR: z.string().min(1).default(path.resolve(process.cwd(), 'migrations')),
});

export interface Config {
  port: number;
  host: string;
  databaseUrl: string;
  defaultOrgId: string;
  migrationsDir: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.parse(env);
  return {
    port: parsed.PORT,
    host: parsed.HOST,
    databaseUrl: parsed.DATABASE_URL,
    defaultOrgId: parsed.DEFAULT_ORG_ID,
    migrationsDir: parsed.MIGRATIONS_DIR,
  };
}
