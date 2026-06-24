import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 32 random bytes, base64url — opaque session / api-key secret. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 hex of a token, for at-rest storage (never store the raw token). */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time compare of a raw token against a stored SHA-256 hex hash. */
export function verifyTokenHash(token: string, storedHash: string): boolean {
  const a = Buffer.from(hashToken(token), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Presented API key form: rap_<keyId>_<secret>. */
export function formatApiKey(keyId: string, secret: string): string {
  return `rap_${keyId}_${secret}`;
}

export interface ParsedApiKey {
  keyId: string;
  secret: string;
}

/** Parses rap_<keyId>_<secret>; returns null if malformed. */
export function parseApiKey(raw: string): ParsedApiKey | null {
  const m = /^rap_([^_]+)_(.+)$/.exec(raw);
  if (!m) return null;
  return { keyId: m[1], secret: m[2] };
}
