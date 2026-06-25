import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { expect, test } from 'vitest';
import { verifyLicense } from '../src/license/verify';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');

const VALID = {
  v: 1,
  licenseId: 'L1',
  customer: 'Acme Corp',
  issuedAt: '2026-01-01T00:00:00.000Z',
  expiry: '2099-12-31T23:59:59.000Z',
  seats: 50,
};

/** Builds an Ed25519-signed license envelope (file bytes). */
function envelope(payloadObj: unknown, key: KeyObject = privateKey): Buffer {
  const payloadBytes = Buffer.from(JSON.stringify(payloadObj), 'utf8');
  const sig = sign(null, payloadBytes, key);
  return Buffer.from(
    JSON.stringify({ payload: payloadBytes.toString('base64url'), sig: sig.toString('base64url') }),
    'utf8',
  );
}

test('valid license -> ok + summary', () => {
  const r = verifyLicense(envelope(VALID), publicKey);
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.summary).toEqual({
      licenseId: 'L1',
      customer: 'Acme Corp',
      issuedAt: VALID.issuedAt,
      expiry: VALID.expiry,
      seats: 50,
    });
  }
});

test('signature by a different key -> BadSignature', () => {
  const other = generateKeyPairSync('ed25519');
  expect(verifyLicense(envelope(VALID, other.privateKey), publicKey)).toEqual({ ok: false, reason: 'BadSignature' });
});

test('tampered payload (sig no longer matches bytes) -> BadSignature', () => {
  const env = JSON.parse(envelope(VALID).toString('utf8')) as { payload: string; sig: string };
  env.payload = Buffer.from(JSON.stringify({ ...VALID, seats: 9999 }), 'utf8').toString('base64url');
  const r = verifyLicense(Buffer.from(JSON.stringify(env), 'utf8'), publicKey);
  expect(r).toEqual({ ok: false, reason: 'BadSignature' });
});

test('expired license -> Expired (summary still surfaced)', () => {
  const r = verifyLicense(envelope({ ...VALID, expiry: '2020-01-01T00:00:00.000Z' }), publicKey);
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.reason).toBe('Expired');
    expect(r.summary?.customer).toBe('Acme Corp');
  }
});

test('expiry is hard (now param past expiry) -> Expired', () => {
  const r = verifyLicense(envelope(VALID), publicKey, new Date('2100-06-01T00:00:00.000Z'));
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.reason).toBe('Expired');
});

test('missing field (no seats) but validly signed -> PayloadInvalid', () => {
  const noSeats = {
    v: 1,
    licenseId: 'L1',
    customer: 'Acme Corp',
    issuedAt: VALID.issuedAt,
    expiry: VALID.expiry,
  };
  expect(verifyLicense(envelope(noSeats), publicKey)).toMatchObject({ ok: false, reason: 'PayloadInvalid' });
});

test('wrong version -> PayloadInvalid', () => {
  expect(verifyLicense(envelope({ ...VALID, v: 2 }), publicKey)).toMatchObject({ ok: false, reason: 'PayloadInvalid' });
});

test('envelope not JSON -> EnvelopeInvalid', () => {
  expect(verifyLicense(Buffer.from('not json at all', 'utf8'), publicKey)).toEqual({ ok: false, reason: 'EnvelopeInvalid' });
});

test('envelope missing sig field -> EnvelopeInvalid', () => {
  expect(verifyLicense(Buffer.from(JSON.stringify({ payload: 'abc' }), 'utf8'), publicKey)).toEqual({
    ok: false,
    reason: 'EnvelopeInvalid',
  });
});
