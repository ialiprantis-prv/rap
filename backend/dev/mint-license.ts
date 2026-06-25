// DEV ONLY. (Re)mints backend/dev/license.sample.json signed with the dev
// private key in backend/dev/keypair.json. The production license is signed
// offline by PRV with the production private key (not in this repo).
// Run: npm -w @rap/backend run dev:mint-license   (uses tsx).
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const here = path.resolve(import.meta.dirname);
const keypair = JSON.parse(readFileSync(path.join(here, 'keypair.json'), 'utf8'));
const privateKey = createPrivateKey({
  key: Buffer.from(keypair.privateKey, 'base64url'),
  format: 'der',
  type: 'pkcs8',
});

// Fixed dates keep the committed sample stable (Ed25519 is deterministic).
const payload = {
  v: 1,
  licenseId: 'dev-0001',
  customer: 'PRIVACT Dev',
  issuedAt: '2026-01-01T00:00:00.000Z',
  expiry: '2099-12-31T23:59:59.000Z',
  seats: 25,
};

const payloadBytes = Buffer.from(JSON.stringify(payload), 'utf8');
const sig = sign(null, payloadBytes, privateKey);
const envelope = { payload: payloadBytes.toString('base64url'), sig: sig.toString('base64url') };
writeFileSync(path.join(here, 'license.sample.json'), JSON.stringify(envelope, null, 2) + '\n');
console.log('minted backend/dev/license.sample.json for', payload.customer, 'expiry', payload.expiry);
