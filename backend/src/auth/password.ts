import { type BinaryLike, randomBytes, scrypt as scryptCb, type ScryptOptions, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify<BinaryLike, BinaryLike, number, ScryptOptions, Buffer>(scryptCb);

// scrypt cost parameters, PHC-style. N=2^15, r=8, p=1, 64-byte derived key.
const N = 32768;
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALT_BYTES = 16;
// N=2^15, r=8 needs ~128*N*r = 33.5 MiB; default maxmem (32 MiB) is too low.
const MAXMEM = 64 * 1024 * 1024;

async function derive(plain: string, salt: Buffer, keylen: number): Promise<Buffer> {
  return scrypt(plain, salt, keylen, { N, r: R, p: P, maxmem: MAXMEM });
}

/** Returns a PHC-style string: $scrypt$N=..,r=..,p=..$<saltB64>$<hashB64>. */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await derive(plain, salt, KEYLEN);
  return `$scrypt$N=${N},r=${R},p=${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

/** Constant-time verify of a plain password against a stored PHC string. */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split('$'); // ['', 'scrypt', 'N=..,r=..,p=..', saltB64, hashB64]
  if (parts.length !== 5 || parts[1] !== 'scrypt') return false;
  const params = parseParams(parts[2]);
  if (!params) return false;
  const salt = Buffer.from(parts[3], 'base64');
  const expected = Buffer.from(parts[4], 'base64');
  const actual = await scrypt(plain, salt, expected.length, {
    N: params.N,
    r: params.r,
    p: params.p,
    maxmem: MAXMEM,
  });
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/**
 * Burns one scrypt derivation and returns false. Used for unknown/disabled
 * users at login so response timing does not reveal account existence.
 */
export async function dummyVerify(plain: string): Promise<false> {
  await derive(plain, DUMMY_SALT, KEYLEN);
  return false;
}

const DUMMY_SALT = Buffer.alloc(SALT_BYTES);

function parseParams(s: string): { N: number; r: number; p: number } | null {
  const m = /^N=(\d+),r=(\d+),p=(\d+)$/.exec(s);
  if (!m) return null;
  return { N: Number(m[1]), r: Number(m[2]), p: Number(m[3]) };
}
