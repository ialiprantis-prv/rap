// @rap/backend — STUB (C0). The API service is seeded at a later rung. This stub
// exists only to wire the workspace + project reference and to prove the backend
// reuses the shared engine (no second methodology implementation).

import { RISK_SCALE_MAX, computeRiskV3 } from '@rap/engine';

/** Marker so the workspace has a real, type-checked export at C0. */
export const RAP_BACKEND_STUB = true as const;

/** Re-exported from the shared kernel — backend and browser score identically. */
export { RISK_SCALE_MAX, computeRiskV3 };
