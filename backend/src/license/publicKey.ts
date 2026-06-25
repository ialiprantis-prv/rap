import { createPublicKey, type KeyObject } from 'node:crypto';

/**
 * PRODUCTION license-signing public key (Ed25519, SPKI DER as base64url).
 *
 * The matching PRIVATE key is held OFFLINE by PRV and is NOT in this repo.
 * This constant is compiled in (esbuild-inlined) and is NOT operator-overridable:
 * there is deliberately no env switch for the verification key, so the license
 * gate cannot be bypassed at runtime. The dev keypair lives only under
 * backend/dev/ and is never imported by this prod entry path.
 */
const PROD_PUBLIC_KEY_SPKI_B64URL = 'MCowBQYDK2VwAyEAQH3EGLfpCOSSY0DQUt9OOg8clfc0z5zQ4x1U5RsXvoo';

export const PROD_LICENSE_PUBLIC_KEY: KeyObject = createPublicKey({
  key: Buffer.from(PROD_PUBLIC_KEY_SPKI_B64URL, 'base64url'),
  format: 'der',
  type: 'spki',
});
