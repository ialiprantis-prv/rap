// Engine kernel subset — threat/CVSS primitives. Ported from risk-frontend
// src/types/threat.ts (minimal: the methodology kernel only needs the CIA
// dimension token and the CVSS severity band label).

/** A confidentiality / integrity / availability dimension. */
export type CiaDim = 'C' | 'I' | 'A';

/** CVSS qualitative base-severity band. */
export type CvssSeverity = 'None' | 'Low' | 'Medium' | 'High' | 'Critical';
