// Engine kernel subset — threat catalog/working-set shapes. Ported from
// risk-frontend src/types/catalog.ts (minimal: only the fields the methodology
// reads — CIA applicability flags, deliberate/accidental origin for the
// probability heuristic, and the working-set identity bookkeeping).
//
// CIA mapping note (methodology): MAGERIT dimensions map C->C, I->I, D->A.

/** C/I/A applicability flags. */
export interface CiaFlags {
  c: boolean;
  i: boolean;
  a: boolean;
}

/** Whether the threat arises by accident, deliberate attack, or both. Drives
 *  the Purdue-zone probability modifier (deliberate threats only). */
export interface ThreatOrigin {
  deliberate: boolean;
  accidental: boolean;
}

/** Global read-only catalog threat (MAGERIT-faithful shape; kernel subset). */
export interface CatalogThreat {
  id: string;
  name: string;
  type: string;
  ciaFlags: CiaFlags;
  origin: ThreatOrigin;
  source: string;
  /** True when loaded with CIA flags UNSET (analyst must assign them).
   *  `ciaFlags` stays a valid all-false object; the badge keys off this flag. */
  ciaUnset?: boolean;
}

/** Per-project working-set threat. Superset of CatalogThreat with overlay
 *  bookkeeping. `catalogRef` points back to the catalog id for "kept" threats;
 *  `isCustom` is true for user-authored ones. */
export interface ProjectThreat extends CatalogThreat {
  projectId: string;
  catalogRef?: string;
  isCustom: boolean;
}
