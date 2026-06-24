import type { AppDb } from '../db/client';
import type { Config } from '../config';
import * as userRepo from '../repository/users';
import { hashPassword } from './password';
import { AuthBootstrapError } from './errors';

/**
 * Idempotent first-boot seed. If any users already exist -> no-op. If none and
 * RAP_ADMIN_* are both set -> create the PRV super-admin with
 * must_change_password=1. If none and env unset -> fail closed (throw).
 */
export async function seedAdmin(db: AppDb, cfg: Config): Promise<void> {
  if (userRepo.count(db) > 0) return;
  if (!cfg.adminUsername || !cfg.adminPassword) {
    throw new AuthBootstrapError(
      'No users exist and RAP_ADMIN_USERNAME/RAP_ADMIN_PASSWORD are not set; refusing to start (fail closed).',
    );
  }
  const passwordHash = await hashPassword(cfg.adminPassword);
  userRepo.create(db, cfg.defaultOrgId, {
    username: cfg.adminUsername,
    passwordHash,
    role: 'prv_super_admin',
    mustChangePassword: true,
  });
}
