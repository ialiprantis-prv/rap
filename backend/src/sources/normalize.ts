// Shared normalizers for source clients. Two jobs: (1) canonicalise source id /
// identity kind to a known lowercase set so a mis-cased variant can never
// collide on a separate cache row; (2) derive the VERSION-BEARING cache
// identity_value so two versions never share one row (NVD's CPE is already
// version-bearing; a purl must carry its version).
import type { AssetIdentity, IdentityKind, SourceId } from './types';

const SOURCE_IDS = new Set<string>(['nvd', 'osv', 'epss', 'kev', 'euvd']);
const IDENTITY_KINDS = new Set<string>(['cpe', 'purl']);

export function normalizeSourceId(s: string): SourceId {
  const v = s.trim().toLowerCase();
  if (!SOURCE_IDS.has(v)) throw new Error(`unknown source id: ${s}`);
  return v as SourceId;
}

export function normalizeIdentityKind(k: string): IdentityKind {
  const v = k.trim().toLowerCase();
  if (!IDENTITY_KINDS.has(v)) throw new Error(`unknown identity kind: ${k}`);
  return v as IdentityKind;
}

/** A version-bearing purl (the canonical cache key), or null if not versionable. */
export function versionedPurl(purl: string | undefined, version: string | undefined): string | null {
  const p = purl?.trim();
  if (!p) return null;
  if (p.includes('@')) return p; // already versioned
  const v = version?.trim();
  return v ? `${p}@${v}` : null; // attach declared version, else cannot key -> skip
}

/** The version-bearing identity_value for a source's identityKind, or null to skip. */
export function canonicalIdentityValue(kind: IdentityKind, identity: AssetIdentity): string | null {
  if (kind === 'cpe') return identity.cpe?.trim() || null;
  return versionedPurl(identity.purl, identity.version);
}
