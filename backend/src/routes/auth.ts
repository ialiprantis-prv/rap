import type { CookieSerializeOptions } from '@fastify/cookie';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../app';
import type { User } from '../db/schema';
import { InvalidCredentialsError } from '../auth/errors';
import { dummyVerify, hashPassword, verifyPassword } from '../auth/password';
import { generateToken, hashToken } from '../auth/tokens';
import * as sessionRepo from '../repository/sessions';
import * as userRepo from '../repository/users';

const LoginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const PasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12),
});

/** Public-facing user shape — never includes the password hash. */
function publicUser(u: Pick<User, 'id' | 'username' | 'role' | 'mustChangePassword'>) {
  return { id: u.id, username: u.username, role: u.role, mustChangePassword: u.mustChangePassword === 1 };
}

export const authRoutes: FastifyPluginAsync<AppDeps> = async (app, opts) => {
  const { db, defaultOrgId, cookieName, cookieSecure, sessionAbsoluteTtlMs } = opts;

  const cookieOpts: CookieSerializeOptions = {
    httpOnly: true,
    signed: true,
    sameSite: 'lax',
    secure: cookieSecure,
    path: '/',
    maxAge: Math.floor(sessionAbsoluteTtlMs / 1000),
  };

  // Public. Generic 401 + timing-equalised so it cannot enumerate accounts.
  app.post('/login', async (req, reply) => {
    const { username, password } = LoginBody.parse(req.body);
    const user = userRepo.findByUsername(db, defaultOrgId, username);
    if (!user || user.disabled) {
      await dummyVerify(password);
      throw new InvalidCredentialsError();
    }
    if (!(await verifyPassword(password, user.passwordHash))) {
      throw new InvalidCredentialsError();
    }
    const token = generateToken();
    sessionRepo.create(db, {
      orgId: user.orgId,
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: Date.now() + sessionAbsoluteTtlMs,
    });
    reply.setCookie(cookieName, token, cookieOpts);
    return reply.status(200).send({ user: publicUser(user) });
  });

  // Public + idempotent. Clears the session if present.
  app.post('/logout', async (req, reply) => {
    const raw = req.cookies[cookieName];
    if (raw) {
      const u = req.unsignCookie(raw);
      if (u.valid && u.value !== null) sessionRepo.deleteByTokenHash(db, hashToken(u.value));
    }
    reply.clearCookie(cookieName, { path: '/' });
    return reply.status(200).send({ ok: true });
  });

  // Session-required.
  app.get('/me', async (req, reply) => {
    if (!req.user) return reply.status(401).send({ error: 'Unauthorized' });
    const { id, username, role, mustChangePassword } = req.user;
    return { user: { id, username, role, mustChangePassword } };
  });

  // Session-required. Rotates password, clears must-change, revokes other sessions.
  app.post('/me/password', async (req, reply) => {
    if (!req.user) return reply.status(401).send({ error: 'Unauthorized' });
    const { currentPassword, newPassword } = PasswordBody.parse(req.body);
    const user = userRepo.getById(db, req.user.orgId, req.user.id);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new InvalidCredentialsError();
    }
    userRepo.setPassword(db, user.orgId, user.id, await hashPassword(newPassword));
    const raw = req.cookies[cookieName];
    const u = raw ? req.unsignCookie(raw) : null;
    const keepHash = u && u.valid && u.value !== null ? hashToken(u.value) : '';
    sessionRepo.deleteOthersForUser(db, user.id, keepHash);
    return reply.status(200).send({ ok: true });
  });
};
