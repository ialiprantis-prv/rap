import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app';
import type { User } from '../db/schema';
import { ROLE_VALUES } from '../db/schema';
import { ForbiddenError } from '../auth/errors';
import { canActOn, canAssign } from '../auth/roles';
import { hashPassword } from '../auth/password';
import * as sessionRepo from '../repository/sessions';
import * as userRepo from '../repository/users';

const CreateBody = z.object({
  username: z.string().min(1),
  password: z.string().min(12),
  role: z.enum(ROLE_VALUES),
});
const PatchBody = z.object({
  role: z.enum(ROLE_VALUES).optional(),
  disabled: z.boolean().optional(),
});
const ResetBody = z.object({ newPassword: z.string().min(12) });
const Params = z.object({ id: z.string().min(1) });

/** Public view of a user — never the password hash. */
function publicUser(u: User) {
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    mustChangePassword: u.mustChangePassword === 1,
    disabled: u.disabled === 1,
  };
}

export const userRoutes: FastifyPluginAsync<AppDeps> = async (app, opts) => {
  const { db, defaultOrgId } = opts;
  const adminCfg = { config: { requiredRole: 'org_admin' as const } };

  app.post('/users', adminCfg, async (req, reply) => {
    const actor = req.user!;
    const { username, password, role } = CreateBody.parse(req.body);
    if (!canAssign(actor.role, role)) throw new ForbiddenError('Forbidden');
    const user = userRepo.create(db, defaultOrgId, {
      username,
      passwordHash: await hashPassword(password),
      role,
      mustChangePassword: true,
    });
    return reply.status(201).send(publicUser(user));
  });

  app.get('/users', adminCfg, async () => userRepo.listUsers(db, defaultOrgId).map(publicUser));

  app.patch('/users/:id', adminCfg, async (req, reply) => {
    const actor = req.user!;
    const { id } = Params.parse(req.params);
    const patch = PatchBody.parse(req.body);
    const target = userRepo.getById(db, defaultOrgId, id);
    if (!target) return reply.status(404).send({ error: 'NotFound' });
    if (!canActOn(actor.role, target.role)) throw new ForbiddenError('Forbidden');
    if (patch.role !== undefined) {
      if (!canAssign(actor.role, patch.role)) throw new ForbiddenError('Forbidden');
      userRepo.setRole(db, defaultOrgId, id, patch.role);
    }
    if (patch.disabled !== undefined) {
      userRepo.setDisabled(db, defaultOrgId, id, patch.disabled);
      if (patch.disabled) sessionRepo.deleteForUser(db, id); // revoke active sessions
    }
    return publicUser(userRepo.getById(db, defaultOrgId, id) ?? target);
  });

  app.post('/users/:id/reset-password', adminCfg, async (req, reply) => {
    const actor = req.user!;
    const { id } = Params.parse(req.params);
    const { newPassword } = ResetBody.parse(req.body);
    const target = userRepo.getById(db, defaultOrgId, id);
    if (!target) return reply.status(404).send({ error: 'NotFound' });
    if (!canActOn(actor.role, target.role)) throw new ForbiddenError('Forbidden');
    userRepo.setPasswordMustChange(db, defaultOrgId, id, await hashPassword(newPassword));
    sessionRepo.deleteForUser(db, id);
    return reply.status(200).send({ ok: true });
  });
};
