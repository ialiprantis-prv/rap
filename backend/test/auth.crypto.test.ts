import { expect, test } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/password';
import { formatApiKey, generateToken, hashToken, parseApiKey, verifyTokenHash } from '../src/auth/tokens';

test('scrypt: roundtrip and wrong-password fail', async () => {
  const hash = await hashPassword('correct horse battery staple');
  expect(hash.startsWith('$scrypt$')).toBe(true);
  expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
  expect(await verifyPassword('wrong password', hash)).toBe(false);
});

test('scrypt: distinct salts produce distinct hashes', async () => {
  const a = await hashPassword('same-password');
  const b = await hashPassword('same-password');
  expect(a).not.toBe(b);
});

test('tokens: gen/hash/verify and tamper fail', () => {
  const token = generateToken();
  const stored = hashToken(token);
  expect(verifyTokenHash(token, stored)).toBe(true);
  expect(verifyTokenHash(token + 'x', stored)).toBe(false);
});

test('api key: format/parse roundtrip', () => {
  const key = formatApiKey('kid', 'sek_ret');
  expect(key).toBe('rap_kid_sek_ret');
  expect(parseApiKey(key)).toEqual({ keyId: 'kid', secret: 'sek_ret' });
  expect(parseApiKey('not-a-key')).toBeNull();
});
