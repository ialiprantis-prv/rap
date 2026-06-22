// Engine kernel subset — asset + ROLFP impact shapes. Ported from risk-frontend
// src/types/{asset,rolfp,project}.ts (minimal: the methodology reads the asset
// type, the Purdue zone, and the 15-cell ROLFP matrix).

/** Shared 0-4 risk score (engine's authoritative scale). Backs the ROLFP cells. */
export type RiskScore = 0 | 1 | 2 | 3 | 4;

/** One ROLFP row: the C/I/A impact for one of the five dimensions. */
export interface RolfpRow {
  c: RiskScore;
  i: RiskScore;
  a: RiskScore;
}

/** 15-cell ROLFP impact matrix (5 dimensions x CIA). Methodology-invariant. */
export interface Rolfp {
  reputation: RolfpRow;
  operational: RolfpRow;
  legal: RolfpRow;
  financial: RolfpRow;
  personal: RolfpRow;
}

/** Canonical CycloneDX 1.6 component type. */
export type CycloneDxComponentType =
  | 'application'
  | 'framework'
  | 'library'
  | 'container'
  | 'platform'
  | 'operating-system'
  | 'device'
  | 'device-driver'
  | 'firmware'
  | 'file'
  | 'machine-learning-model'
  | 'data'
  | 'cryptographic-asset';

/** Canonical asset-type taxonomy id: the CycloneDX component types plus the
 *  PRIVACT `service` pseudo-type. */
export type AssetTypeId = CycloneDxComponentType | 'service';

/** PRIVACT methodology extension carried by every asset. */
export interface PrivactExt {
  /** Purdue/ISA-95 zone the asset resides in (drives the probability modifier). */
  residesIn: string;
  rolfp: Rolfp;
}

/** Asset (kernel subset — identity, type, and the methodology extension). */
export interface Asset {
  id: string;
  name: string;
  assetType: AssetTypeId;
  privact: PrivactExt;
}
