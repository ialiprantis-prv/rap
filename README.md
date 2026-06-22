# RAP — PRIVACT Risk Assessment Platform (v4)

npm-workspaces monorepo for the AENAON EU H2020 cybersecurity project
(GA 101249723). The v4 rebuild splits the platform into three workspaces around a
**single shared methodology engine** — the v3 PRIVACT kernel ported verbatim, so
server and browser compute identical risk with zero drift.

## Workspaces

| Package         | Role                                                                 |
| --------------- | -------------------------------------------------------------------- |
| `@rap/engine`   | Pure TS methodology kernel. The ONLY implementation of the formula. |
| `@rap/backend`  | API service (stub at C0; seeded later).                              |
| `@rap/frontend` | UI (stub at C0; seeded at the frontend rung).                        |

## Methodology kernel (invariant)

`Risk_d = Applicability_d × Impact_d × Probability × Severity` (0–80 scale).

- **Applicability** — threat-CIA-only (`threat.ciaFlags[d]`); `max(C, I, A)`.
- **Bands** — Low 0–8 / Medium 9–29 / High 30–80.
- **Severity** — `defaultSeverityFromCvss` = `round(CVSS / 2)` clamped 0–5
  (v3 C4 live rule; spec §15.3). Unset CVSS → undefined (indeterminate).
- **INDETERMINATE** — unset severity is not a real 0; `riskScore` is 0 but
  callers must show "indeterminate", never a band.
- **Residual** — severity-only; `residualSev = remediate ? 0 : max(0, sev −
  strongest D3FEND tactic delta)`. Strongest-single, never additive.
- **Probability** — baseline 2 + Purdue/ISA-95 zone modifier (deliberate threats
  only).

Cascading is deferred to C1.

## Setup

```bash
nvm use            # Node pinned in .nvmrc
npm install        # resolves all workspaces
npm run build      # tsc -b (engine → backend)
npm run lint       # eslint
npm test           # vitest (parity-locked)
```
