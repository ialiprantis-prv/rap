import { verify as edVerify, type KeyObject } from 'node:crypto';
import { z } from 'zod';

/**
 * License payload schema. issuedAt is ISO-8601 (offset allowed); expiry is
 * ISO-8601 UTC and is a HARD limit (no grace). seats is recorded/surfaced only.
 */
export const LicensePayloadSchema = z.object({
  v: z.literal(1),
  licenseId: z.string().min(1),
  customer: z.string().min(1),
  issuedAt: z.string().datetime({ offset: true }),
  expiry: z.string().datetime(),
  seats: z.number().int().positive(),
});
export type LicensePayload = z.infer<typeof LicensePayloadSchema>;

export interface LicenseSummary {
  licenseId: string;
  customer: string;
  issuedAt: string;
  expiry: string;
  seats: number;
}

export type LicenseReason = 'EnvelopeInvalid' | 'BadSignature' | 'PayloadInvalid' | 'Expired';

export type LicenseVerifyResult =
  | { ok: true; summary: LicenseSummary }
  | { ok: false; reason: LicenseReason; summary?: LicenseSummary };

const EnvelopeSchema = z.object({ payload: z.string().min(1), sig: z.string().min(1) });

function toSummary(p: LicensePayload): LicenseSummary {
  return { licenseId: p.licenseId, customer: p.customer, issuedAt: p.issuedAt, expiry: p.expiry, seats: p.seats };
}

/**
 * Verifies a detached-signature license envelope against an Ed25519 public key.
 * Order: parse envelope -> Ed25519-verify the signature over the EXACT decoded
 * payload bytes -> JSON.parse + schema-validate -> expiry. No canonicalization.
 */
export function verifyLicense(fileBytes: Buffer, publicKey: KeyObject, now = new Date()): LicenseVerifyResult {
  let envelope: { payload: string; sig: string };
  try {
    envelope = EnvelopeSchema.parse(JSON.parse(fileBytes.toString('utf8')));
  } catch {
    return { ok: false, reason: 'EnvelopeInvalid' };
  }

  const payloadBytes = Buffer.from(envelope.payload, 'base64url');
  const sigBytes = Buffer.from(envelope.sig, 'base64url');
  try {
    if (!edVerify(null, payloadBytes, publicKey, sigBytes)) {
      return { ok: false, reason: 'BadSignature' };
    }
  } catch {
    return { ok: false, reason: 'BadSignature' };
  }

  let payload: LicensePayload;
  try {
    payload = LicensePayloadSchema.parse(JSON.parse(payloadBytes.toString('utf8')));
  } catch {
    return { ok: false, reason: 'PayloadInvalid' };
  }

  const summary = toSummary(payload);
  if (now.getTime() > new Date(payload.expiry).getTime()) {
    return { ok: false, reason: 'Expired', summary };
  }
  return { ok: true, summary };
}
