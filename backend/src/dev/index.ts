// @rap/backend — DEVELOPMENT entrypoint (run by tsx, NEVER bundled by esbuild).
// Injects the DEV-ONLY license public key from backend/dev/keypair.json and
// points RAP_LICENSE_FILE at the committed sample license. The prod entry
// (src/index.ts) does not import this file, so the dev key cannot leak into the
// production bundle.
import { createPublicKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { startServer } from '../server';

const devDir = path.resolve(import.meta.dirname, '../../dev');
const keypair = JSON.parse(readFileSync(path.join(devDir, 'keypair.json'), 'utf8')) as { publicKey: string };
const devPublicKey = createPublicKey({
  key: Buffer.from(keypair.publicKey, 'base64url'),
  format: 'der',
  type: 'spki',
});

process.env.RAP_LICENSE_FILE ??= path.join(devDir, 'license.sample.json');

void startServer({ licensePublicKey: devPublicKey });
