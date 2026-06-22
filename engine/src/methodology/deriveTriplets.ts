// LIVE triplet derivation + risk. Ported verbatim from risk-frontend
// src/lib/riskTriplets.ts (plus `effectiveSeverity` lifted from
// src/lib/scopeModel.ts). Pure: given the current scope inputs, build one triplet
// per in-scope (asset, threat, CVE) cell and score it with the v3.1 formula. No
// persistence — recomputed on every read. Service / CPE-less assets contribute
// nothing (they have no CVE records).

import { maxPerCia } from './impact';
import { suggestProbability } from './probability';
import { computeRiskV3, type RiskResultV3 } from './risk';
import type { Asset, AssetTypeId } from '../types/asset';
import type { ProjectThreat } from '../types/catalog';
import type { VulnRecord } from '../types/vuln';

/** override ?? defaultSeverity. Lifted from scopeModel.effectiveSeverity. */
export function effectiveSeverity(
  record: VulnRecord,
  overrides: Record<string, number>,
): number | undefined {
  const o = overrides[record.cveId];
  return o !== undefined ? o : record.defaultSeverity;
}

export type ProbabilitySource = 'override' | 'heuristic';
export type SeveritySource = 'override' | 'cvss' | 'unset';

export interface DerivedTriplet {
  id: string;
  assetId: string;
  assetName: string;
  assetType: AssetTypeId;
  zone: string;
  threatId: string;
  threatName: string;
  threatSource: string;
  /** Threat taxonomy type (ENISA/MAGERIT `type`) — heatmap column axis. */
  threatType: string;
  threatCia: { c: boolean; i: boolean; a: boolean };
  /** threat loaded with CIA unset -> applicability all-0 -> Risk 0 (reminder). */
  ciaUnset: boolean;
  probability: number;
  probabilitySource: ProbabilitySource;
  cveId: string;
  /** CWE ids on the CVE (NVD `weaknesses[]`; [] when none). */
  cweIds: string[];
  severity: number | undefined;
  severitySource: SeveritySource;
  exploited: boolean;
  impact: { c: number; i: number; a: number };
  risk: RiskResultV3;
}

export interface DeriveTripletsParams {
  projectId: string;
  assets: Asset[];
  /** assetType -> matched ProjectThreat ids (C5b). */
  matchedByType: Map<AssetTypeId, string[]>;
  threatById: Map<string, ProjectThreat>;
  recordsByAsset: Map<string, VulnRecord[]>;
  severityOverrides: Record<string, number>;
  probabilityOverride: (threatId: string, assetType: AssetTypeId, zone: string) => number | undefined;
  isPruned: (assetId: string, threatId: string, cveId: string) => boolean;
}

export function deriveTriplets(p: DeriveTripletsParams): DerivedTriplet[] {
  const out: DerivedTriplet[] = [];
  for (const asset of p.assets) {
    const zone = asset.privact.residesIn ?? '';
    const impact = maxPerCia(asset.privact.rolfp);
    const threats = (p.matchedByType.get(asset.assetType) ?? [])
      .map((tid) => p.threatById.get(tid))
      .filter((t): t is ProjectThreat => !!t);
    const records = p.recordsByAsset.get(asset.id) ?? [];

    for (const threat of threats) {
      const probOverride = p.probabilityOverride(threat.id, asset.assetType, zone);
      const probability = probOverride ?? suggestProbability(threat.origin, zone);
      for (const rec of records) {
        if (p.isPruned(asset.id, threat.id, rec.cveId)) continue;
        const sev = effectiveSeverity(rec, p.severityOverrides);
        const severitySource: SeveritySource =
          p.severityOverrides[rec.cveId] !== undefined
            ? 'override'
            : rec.defaultSeverity !== undefined
              ? 'cvss'
              : 'unset';
        out.push({
          id: `TR-${p.projectId}-${asset.id}-${threat.id}-${rec.cveId}`,
          assetId: asset.id,
          assetName: asset.name,
          assetType: asset.assetType,
          zone,
          threatId: threat.id,
          threatName: threat.name,
          threatSource: threat.source,
          threatType: threat.type,
          threatCia: threat.ciaFlags,
          ciaUnset: threat.ciaUnset === true,
          probability,
          probabilitySource: probOverride !== undefined ? 'override' : 'heuristic',
          cveId: rec.cveId,
          cweIds: rec.cweIds ?? [],
          severity: sev,
          severitySource,
          exploited: rec.exploited,
          impact,
          risk: computeRiskV3({
            threatCia: threat.ciaFlags,
            assetImpact: impact,
            probability,
            severity: sev,
          }),
        });
      }
    }
  }
  return out;
}
