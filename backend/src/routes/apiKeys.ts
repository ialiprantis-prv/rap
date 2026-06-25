import { randomBytes } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app';
import type { ApiKey } from '../db/schema';
import { ROLE_VALUES } from '../db/schema';
import { ForbiddenError } from '../auth/errors';
import { canAssign } from '../auth/roles';
import { formatApiKey, generateToken, hashToken } from '../auth/tokens';
import * as apiKeyRepo from '../repository/apiKeys';

const CreateBody = z.object({
  label: z.string().min(1),
  role: z.enum(ROLE_VALUES),
});
const Params = z.object({ keyId: z.string().min(1) });

/** Public view of a key — never the secret or its hash. */
function publicKey(k: ApiKey) {
  return {
    keyId: k.keyId,
    label: k.label,
    role: k.role,
    disabled: k.disabled === 1,
    createdBy: k.createdBy,
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt,
  };
}

export const apiKeyRoutes: FastifyPluginAsync<AppDeps> = async (app, opts) => {
  const { db, defaultOrgId } = opts;
  const adminCfg = { config: { requiredRole: 'org_admin' as const } };

  // Issue a key. The full secret is returned ONCE and never stored or logged.
  app.post('/api-keys', adminCfg, async (req, reply) => {
    const actor = req.user!;
    const { label, role } = CreateBody.parse(req.body);
    if (!canAssign(actor.role, role)) throw new ForbiddenError('Forbidden');
    const keyId = randomBytes(8).toString('hex'); // underscore-free
    const secret = generateToken();
    apiKeyRepo.create(db, {
      keyId,
      orgId: defaultOrgId,
      label,
      role,
      tokenHash: hashToken(secret),
      createdBy: actor.id,
    });
    return reply.status(201).send({ keyId, label, role, key: formatApiKey(keyId, secret) });
  });

  app.get('/api-keys', adminCfg, async () => apiKeyRepo.listKeys(db, defaultOrgId).map(publicKey));

  // Revoke by disabling the row (idempotent on an already-disabled key).
  app.delete('/api-keys/:keyId', adminCfg, async (req, reply) => {
    const { keyId } = Params.parse(req.params);
    const key = apiKeyRepo.findByKeyId(db, keyId);
    if (!key || key.orgId !== defaultOrgId) return reply.status(404).send({ error: 'NotFound' });
    apiKeyRepo.setDisabled(db, keyId, true);
    return reply.status(204).send();
  });
};
