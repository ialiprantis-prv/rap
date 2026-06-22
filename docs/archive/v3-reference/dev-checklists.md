# Dev Checklists

Reusable manual-verification scripts for browser DevTools console. Same
scripts will be re-run later against the real backend to confirm parity with
the MSW mocks (see `docs/backend-endpoints.md`). Run them on a page where
the MSW worker is active (anywhere inside the app in `npm run dev`).

> **Last verified 2026-06-02 (v2.0 docs refresh).** The Gate 4.5 contract +
> per-phase MSW probes below are current. v2-era sweep items appended at the
> end of this file (see "v2 sweep additions").

## Gate 4.5 — the canonical checklist (mandatory before any commit)

Triggered by any rename or refactor that crosses module boundaries.

1. **`npx tsc -b`** → exit 0.
2. **`npx eslint src`** → exit 0.
3. **`npm run build`** → exit 0. Note bundle size delta (raw + gz) against
   the last known baseline.
4. **Endpoint inventory** — `grep -rhn -E "http\.(get|post|patch|put|delete)\(" src/mocks/handlers | wc -l` → expected count (currently **52** post-C9c: peaked at 64 through C9b, then C9c removed the 12 dead v2 export/dashboard/mitigation endpoints).
5. **Dev-boot smoke — ALL top-level routes** — `npm run dev`, then with the
   MSW worker active and a hard-reload (Ctrl+Shift+R or unregister SW +
   reload) on each, visit **every** top-level route and confirm it renders
   real content with **zero console errors** — not a blank white page.
   Source-on-disk green ≠ page boots, and a green build will not catch a
   runtime render crash (e.g. a persisted-data shape change that throws on
   read). One blank route fails the whole gate. Routes (from `src/App.tsx`):
   - `/login`
   - `/projects` (project list)
   - `/projects/:id` (project overview) — use `demo-2`
   - `/projects/:id/setup`
   - `/projects/:id/assets`
   - `/projects/:id/review`
   - `/projects/:id/triplets`
   - `/projects/:id/mitigations`
   - `/projects/:id/dashboard`
   - `/projects/:id/export`
   - `/catalog`

   Because persisted-data crashes only surface against *existing*
   localStorage (a fresh boot reseeds clean), at least once per shape-changing
   commit reload the routes **without clearing storage** so pre-change data is
   exercised. See `docs/working-agreement.md` Gate 4.5 + the Phase 5b
   regression case study in `docs/open-items.md`.
6. **File-size audit** — `wc -l` each modified file; flag anything over the
   260-line hard cap with rationale for the deviation OR a split plan.

Report all 6 in the sweep summary alongside any deviations from spec.

### Persisted-store shape changes (standing policy)

When a commit changes a persisted (localStorage) shape, the dev-boot smoke
(step 5) MUST reload at least once **without clearing storage** so pre-change
data is exercised — a fresh boot reseeds clean and hides the regression.

The fix for any shape drift is to **extend the read-boundary normalizer**
(`normalizeAsset` in `src/mocks/assetStore.ts` and peers), never to bump or
discard the store key (data-lossy, rejected as policy — see `CLAUDE.md`
"Persisted-store evolution policy"). A top-level `ErrorBoundary`
(`src/components/ErrorBoundary.tsx`) is a runtime backstop that turns a render
throw into an error card, but it does not excuse skipping the normalizer.

---

## Phase 5a — Assets read-only table

Verifies the 4 MSW handlers (`POST/PATCH/DELETE /projects/:id/assets`,
`GET /catalog/asset-categories`) that the 5a UI does not yet call, plus the
`?empty=1` test affordance and the list endpoint itself.

All snippets run against `demo-2` (Hospital IoT Network — the seeded
project). Paste each block at the DevTools console and check the expected
output.

### 0. Catalog returns the 7 verbatim categories

```js
await fetch('/api/v1/catalog/asset-categories').then((r) => r.json());
// expect: 7 items, e.g.
// [{id:'database',label:'Database'},{id:'application-api',label:'Application/API'},
//  {id:'container',...},{id:'container-network',...},{id:'hardware',...},
//  {id:'os',...},{id:'tcp-ip',label:'TCP/IP'}]
```

### 1. POST → 201, new asset stored

```js
const created = await fetch('/api/v1/projects/demo-2/assets', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Probe Asset', categoryId: 'database' }),
}).then(async (r) => ({ status: r.status, body: await r.json() }));
console.log(created);
// expect: { status: 201, body: { id: 'ast-…', name: 'Probe Asset',
//   categoryId: 'database', residesIn: '', comments: '',
//   rolfp: { reputation:{c:0,i:0,a:0}, … } } }

const probeId = created.body.id; // keep for steps 2 & 3
```

Negative cases (each should return `400` with a `message`):

```js
await fetch('/api/v1/projects/demo-2/assets', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: '', categoryId: 'database' }),
}).then((r) => r.status); // expect: 400

await fetch('/api/v1/projects/demo-2/assets', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'X', categoryId: 'bogus' }),
}).then((r) => r.status); // expect: 400
```

### 2. PATCH → 200, name updated

```js
await fetch(`/api/v1/projects/demo-2/assets/${probeId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Probe Asset (updated)' }),
}).then(async (r) => ({ status: r.status, body: await r.json() }));
// expect: { status: 200, body: { id: probeId, name: 'Probe Asset (updated)', … } }

await fetch('/api/v1/projects/demo-2/assets/does-not-exist', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'x' }),
}).then((r) => r.status); // expect: 404
```

### 3. DELETE → 204, removed from store

```js
const before = (
  await fetch('/api/v1/projects/demo-2/assets').then((r) => r.json())
).length;
const del = await fetch(`/api/v1/projects/demo-2/assets/${probeId}`, {
  method: 'DELETE',
});
const after = (
  await fetch('/api/v1/projects/demo-2/assets').then((r) => r.json())
).length;
console.log({ status: del.status, before, after });
// expect: { status: 204, after === before - 1 }

await fetch('/api/v1/projects/demo-2/assets/does-not-exist', {
  method: 'DELETE',
}).then((r) => r.status); // expect: 404
```

### 4. `?empty=1` list override

```js
await fetch('/api/v1/projects/demo-2/assets?empty=1').then((r) => r.json());
// expect: []  (does NOT delete the seed; just short-circuits the response)

await fetch('/api/v1/projects/demo-2/assets').then((r) => r.json()).then((l) => l.length);
// expect: 12 (seed unchanged)
```

### Reuse for real-backend integration

When the real backend lands, swap the in-browser MSW for the actual server
(point Vite at the backend, or run the snippets against the deployed URL).
The same expected behaviours must hold; any divergence is a backend bug or a
contract drift to reconcile.

---

## Phase 5b — Asset edit pane (interactive)

In-browser checks that exercise the new wiring on top of the Phase 5a
contract: extended `POST` body, the `setQueriesData` cache strategy, the
AbortController-cancellation of superseded PATCHes, and the uniform
flush-or-discard policy.

All snippets continue to run against `demo-2` (Hospital IoT Network).

### 5. Extended `POST` body (atomic first-save for drafts)

```js
const created = await fetch('/api/v1/projects/demo-2/assets', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Probe with extras',
    categoryId: 'application-api',
    residesIn: 'Orchestrator',
    comments: 'created via extended-body snippet',
    rolfp: {
      reputation:  { c: 1, i: 2, a: 0 },
      operational: { c: 0, i: 0, a: 0 },
      legal:       { c: 0, i: 0, a: 0 },
      financial:   { c: 0, i: 0, a: 0 },
      personal:    { c: 0, i: 0, a: 0 },
    },
  }),
}).then(async (r) => ({ status: r.status, body: await r.json() }));
console.log(created);
// expect: { status: 201, body: { id: 'ast-…', name: 'Probe with extras',
//   categoryId: 'application-api', residesIn: 'Orchestrator',
//   comments: 'created via extended-body snippet', rolfp: { reputation: {c:1,i:2,a:0}, … } } }

// Cleanup:
await fetch(`/api/v1/projects/demo-2/assets/${created.body.id}`, { method: 'DELETE' });
```

Confirms the server seeds residesIn/comments/rolfp from the request when
present, instead of using its zeroed defaults.

### 6. AbortController cancels superseded PATCH (race avoidance)

This one needs to be exercised through the UI (the `useAssetAutoSave` hook
owns the controller). Steps:

1. Open the AssetsPage and click any seeded asset (e.g. `Patient Records DB`
   doesn't exist; use `MariaDB CDR`).
2. Edit Comments rapidly: type a long sentence in a single 2-second burst.
3. Open DevTools → Network and watch the `PATCH …/assets/:aid` calls. You
   should see at most one in flight at any moment; any earlier PATCH that
   was still pending is cancelled (`(canceled)` in the Network tab).
4. The final value in the cache matches the final typed value (the row's
   Impact column and the Comments field reflect the latest content after
   ~610ms of idle).

If two PATCHes complete out of order, the test FAILS — the implementation
must abort the older one.

### 7. Uniform flush-or-discard on context loss

Three scenarios, all should behave the same:

| Trigger | Valid + dirty | Invalid + dirty | Pristine |
|---|---|---|---|
| Row click on another asset | Saves silently, then switches | Toast `"Unsaved changes discarded (validation errors)"` + switches | Switches silently |
| `+ Add Asset` while editing | Saves, then opens an empty draft | Toast + opens draft | Opens draft |
| ✕ close button on the pane | Saves, then closes | Toast + closes | Closes |

To exercise: open a row, clear the Name field (becomes invalid+dirty), then
trigger each context change. Confirm the yellow discard toast appears once
per action; the original server-side name remains unchanged in the cache.

### 8. Save indicator state machine

Make a sequence of edits to verify all six visual states transition
correctly:

- Open an existing asset → header shows `All changes saved automatically`
  (idle).
- Type a single character → `⚠ Unsaved changes…` (pending — during the
  600 ms debounce window).
- Wait ~600 ms → `Saving…` with spinner (PATCH in flight) → `✓ Saved`
  (hover the indicator to see the timestamp tooltip).
- Clear the Name field while still focused → `⚠ Fix errors to save`
  (orange).
- Re-type any character to make it valid → back through pending → saving →
  saved.

The `error` state is only reachable by simulating a network failure (e.g.
temporarily make MSW return 500 for PATCH); not part of the routine check.

### 9. Draft → existing transition (no data loss across the remount)

1. Click `+ Add Asset`. Header shows `New asset`; no save indicator visible
   yet (the form is invalid: name+category empty).
2. Type a Name (e.g. `Probe asset`). Indicator stays hidden (still missing
   the default-selected category isn't an issue — `database` is preselected;
   form becomes valid immediately).
3. Edit a ROLFP cell and a Comments field rapidly.
4. After ~600 ms, the indicator appears with `Saving…`, then `✓ Saved`.
   The new row appears at the bottom of the table.
5. Confirm the new row's Impact column reflects the cell values you typed
   (atomic first POST included them, no separate PATCH was needed).

Cleanup: delete the probe asset via the pane's Delete icon.

---

## Phase 5c — Links sub-feature

Verifies the 3 new link handlers + the asset-delete cascade. All snippets
run against `demo-2` (seeded with 3 links: `ast-1↔ast-2`,
`ast-3↔ast-6`, `ast-9↔ast-11`).

### 10. List seeded links

```js
await fetch('/api/v1/projects/demo-2/links').then((r) => r.json());
// expect: 3 items, each with assetIdA <= assetIdB (lex-normalized)
// e.g. [{ id: 'lnk-1', projectId: 'demo-2', assetIdA: 'ast-1', assetIdB: 'ast-2' }, …]
```

### 11. POST a new link → 201, lex-normalized

```js
const created = await fetch('/api/v1/projects/demo-2/links', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  // Intentionally pass them "wrong way round" to confirm normalization:
  body: JSON.stringify({ assetIdA: 'ast-7', assetIdB: 'ast-4' }),
}).then(async (r) => ({ status: r.status, body: await r.json() }));
console.log(created);
// expect: { status: 201,
//   body: { id: 'lnk-…', projectId: 'demo-2', assetIdA: 'ast-4', assetIdB: 'ast-7' } }
// Note assetIdA = 'ast-4' (lex-lower), NOT the order we sent.

const probeLinkId = created.body.id;
```

### 12. POST same-id (self-link) → 400

```js
await fetch('/api/v1/projects/demo-2/links', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ assetIdA: 'ast-1', assetIdB: 'ast-1' }),
}).then(async (r) => ({ status: r.status, body: await r.json() }));
// expect: { status: 400, body: { message: 'Cannot link asset to itself.' } }
```

### 13. POST missing endpoint → 400

```js
await fetch('/api/v1/projects/demo-2/links', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ assetIdA: 'ast-1' }), // assetIdB missing
}).then(async (r) => ({ status: r.status, body: await r.json() }));
// expect: { status: 400, body: { message: 'Both endpoints are required.' } }
```

### 14. POST duplicate pair → 409 Conflict

```js
// Either order should be rejected (server normalizes before dedupe).
await fetch('/api/v1/projects/demo-2/links', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ assetIdA: 'ast-2', assetIdB: 'ast-1' }), // reversed
}).then(async (r) => ({ status: r.status, body: await r.json() }));
// expect: { status: 409, body: { message: 'These assets are already linked.' } }
```

### 15. DELETE link → 204; cleanup probe

```js
await fetch(`/api/v1/projects/demo-2/links/${probeLinkId}`, {
  method: 'DELETE',
}).then((r) => r.status);
// expect: 204

await fetch('/api/v1/projects/demo-2/links/does-not-exist', {
  method: 'DELETE',
}).then((r) => r.status);
// expect: 404

// Verify it's gone:
const after = await fetch('/api/v1/projects/demo-2/links').then((r) => r.json());
console.log(after.length); // expect: 3 (back to seed count)
```

### 16. Asset-delete cascade

```js
// Pick an asset that has at least one seeded link (e.g. ast-1 has 1 link).
const before = {
  assets: (await fetch('/api/v1/projects/demo-2/assets').then((r) => r.json())).length,
  links: (await fetch('/api/v1/projects/demo-2/links').then((r) => r.json())).length,
};

await fetch('/api/v1/projects/demo-2/assets/ast-1', { method: 'DELETE' });

const after = {
  assets: (await fetch('/api/v1/projects/demo-2/assets').then((r) => r.json())).length,
  links: (await fetch('/api/v1/projects/demo-2/links').then((r) => r.json())).length,
};
console.log({ before, after });
// expect: assets -1, links -1 (the ast-1↔ast-2 link was cascade-removed).
// In the UI: the Links tab should also refresh (useDeleteAsset
// invalidates ['links', projectId] on success).
```

After the cascade test, the Hospital IoT demo loses `ast-1`. Reload the
page if you want a fresh seed (delete `privact_assets_v2` + `privact_links_v1`
from localStorage and refresh).

---

## Phase 2 — Applicable threats & vulnerabilities (Screen 6)

Verifies the 4 new handlers (`GET`/`PATCH` × threats/vulns) and the seed.
All snippets run against `demo-2` (the only project seeded with applicables).

### 17. List engine output

```js
const t = await fetch('/api/v1/projects/demo-2/applicable-threats').then((r) => r.json());
const v = await fetch('/api/v1/projects/demo-2/applicable-vulnerabilities').then((r) => r.json());
console.log({ threats: t.length, vulns: v.length });
// expect: { threats: 12, vulns: 18 }
console.log(t[0]);
// expect a fat object: { id:'demo-2-TH-46', threatId:'TH-46', name:'Malware',
//   type:'Nefarious Activity', cia:['C','I','A'], source:'ENISA', assetCount:6,
//   included:true, description:'…', sourceRef:{label:'…'},
//   assetCategories:['os','container','application-api'], relatedIds:['VU-15','VU-08'] }

// Other projects have no seeded applicables (defensive-empty in the UI):
await fetch('/api/v1/projects/demo-1/applicable-threats').then((r) => r.json());
// expect: []
```

### 18. Non-applicable items present (toggle demo)

```js
const t = await fetch('/api/v1/projects/demo-2/applicable-threats').then((r) => r.json());
const v = await fetch('/api/v1/projects/demo-2/applicable-vulnerabilities').then((r) => r.json());
console.log({
  nonApplicableThreats: t.filter((x) => x.assetCount === 0).map((x) => x.threatId),
  nonApplicableVulns: v.filter((x) => x.assetCount === 0).map((x) => x.vulnId),
});
// expect: { nonApplicableThreats: ['TH-05'], nonApplicableVulns: ['VU-17','VU-18'] }
// These three are hidden when the "Applicable only" toggle is ON (default).
```

### 19. PATCH inclusion → 200, persists

```js
await fetch('/api/v1/projects/demo-2/applicable-threats/TH-46', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ included: false }),
}).then(async (r) => ({ status: r.status, included: (await r.json()).included }));
// expect: { status: 200, included: false } — survives reload (persisted)

// Negative cases:
await fetch('/api/v1/projects/demo-2/applicable-threats/TH-46', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ included: 'yes' }),
}).then((r) => r.status); // expect: 400 (included not a boolean)

await fetch('/api/v1/projects/demo-2/applicable-threats/TH-999', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ included: true }),
}).then((r) => r.status); // expect: 404 (unknown threat)

// Restore for the demo:
await fetch('/api/v1/projects/demo-2/applicable-threats/TH-46', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ included: true }),
}).then((r) => r.status); // 200
```

Reset the inclusion state to seed defaults anytime by deleting
`privact_applicable_v2` from localStorage and reloading.

---

## Phase 3 — Triplets & risk scoring (Screen 7)

Verifies the 4 new handlers + the generator. Run against `demo-2`. Note: the
inclusion store is now `privact_applicable_v2` and assets `privact_assets_v3`
(non-zero seed ROLFP); the triplet store is `privact_triplets_v1`.

### 20. Pre-compute summary (never computed)

```js
await fetch('/api/v1/projects/demo-2/risk-summary').then((r) => r.json());
// expect (before any compute): { projectId:'demo-2', total:0, high:0,
//   medium:0, low:0, lastComputedAt: null }
```

### 21. Compute → done, summary populated

```js
await fetch('/api/v1/projects/demo-2/compute', { method: 'POST' })
  .then((r) => r.json());
// expect: { status: 'done', computedAt: '<ISO>' }

await fetch('/api/v1/projects/demo-2/risk-summary').then((r) => r.json());
// expect: total 75, a high/medium/low split (~32/39/4), lastComputedAt set.
// total === high + medium + low.
```

### 22. Determinism — recompute is stable

```js
const a = await fetch('/api/v1/projects/demo-2/triplets?page_size=100').then((r) => r.json());
await fetch('/api/v1/projects/demo-2/compute', { method: 'POST' });
const b = await fetch('/api/v1/projects/demo-2/triplets?page_size=100').then((r) => r.json());
console.log(a.total === b.total, a.items.map((t) => t.id).join() === b.items.map((t) => t.id).join());
// expect: true true (same inputs → same triplets/ids)
```

### 23. Pagination envelope

```js
await fetch('/api/v1/projects/demo-2/triplets?page=2&page_size=50').then((r) => r.json());
// expect: { items: [...25], page: 2, page_size: 50, total: 75, total_pages: 2 }
```

### 24. Server-side filter + sort

```js
const high = await fetch('/api/v1/projects/demo-2/triplets?band=high&page_size=100').then((r) => r.json());
console.log(high.items.every((t) => t.band === 'high'), high.total); // expect: true, ~32

const min = await fetch('/api/v1/projects/demo-2/triplets?min_risk=30&page_size=100').then((r) => r.json());
console.log(min.items.every((t) => t.riskScore >= 30)); // expect: true

const asc = await fetch('/api/v1/projects/demo-2/triplets?sort=risk_score&order=asc&page_size=100').then((r) => r.json());
console.log(asc.items[0].riskScore <= asc.items.at(-1).riskScore); // expect: true
```

### 25. Single triplet + summary stays unfiltered

```js
const one = (await fetch('/api/v1/projects/demo-2/triplets?page_size=1').then((r) => r.json())).items[0];
await fetch(`/api/v1/projects/demo-2/triplets/${one.id}`).then((r) => r.json());
// expect: the same triplet object (defensive single-fetch; UI uses cached row)

await fetch('/api/v1/projects/demo-2/triplets/does-not-exist').then((r) => r.status); // expect: 404

// risk-summary ignores query params (always project totals):
await fetch('/api/v1/projects/demo-2/risk-summary?band=high').then((r) => r.json());
// expect: full totals, NOT filtered to high
```

Reset triplets anytime by deleting `privact_triplets_v1` from localStorage and
reloading (returns to the pre-compute CTA).

> **Store-key bumps this session.** Phase 3 reseeds three stores on first load:
> assets `privact_assets_v2`→`_v3` (non-zero ROLFP), applicable
> `privact_applicable_v1`→`_v2` (catalog defaults), projects
> `privact_projects_v2`→`_v3` (`scopeVersion` field). One-time reset of any
> hand-edited demo data — expected.

### 26–28. Staleness banner (scopeVersion)

Exercised through the UI (the banner reads `project.scopeVersion` vs
`RiskSummary.computedScopeVersion`). Endpoint-level check:

```js
// Baseline: compute, then read both versions — they should match (not stale).
await fetch('/api/v1/projects/demo-2/compute', { method: 'POST' });
const v0 = (await fetch('/api/v1/projects/demo-2').then((r) => r.json())).scopeVersion;
const c0 = (await fetch('/api/v1/projects/demo-2/risk-summary').then((r) => r.json())).computedScopeVersion;
console.log({ v0, c0, stale: v0 > c0 }); // expect: stale === false (v0 === c0)

// 26. Phase 1 mutation bumps scope → stale. Toggle a threat back to bump via Phase 2 too.
await fetch('/api/v1/projects/demo-2/applicable-threats/TH-46', {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ included: false }),
});
const v1 = (await fetch('/api/v1/projects/demo-2').then((r) => r.json())).scopeVersion;
const c1 = (await fetch('/api/v1/projects/demo-2/risk-summary').then((r) => r.json())).computedScopeVersion;
console.log({ v1, c1, stale: v1 > c1 }); // expect: stale === true (v1 === c0 + 1 > c1)

// 27. Recompute clears staleness.
await fetch('/api/v1/projects/demo-2/applicable-threats/TH-46', {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ included: true }),
}); // restore (also bumps again)
await fetch('/api/v1/projects/demo-2/compute', { method: 'POST' });
const v2 = (await fetch('/api/v1/projects/demo-2').then((r) => r.json())).scopeVersion;
const c2 = (await fetch('/api/v1/projects/demo-2/risk-summary').then((r) => r.json())).computedScopeVersion;
console.log({ v2, c2, stale: v2 > c2 }); // expect: stale === false

// 28. Asset-delete cascade bumps scope ONCE (asset + cascaded links = +1, not +N).
const before = (await fetch('/api/v1/projects/demo-2').then((r) => r.json())).scopeVersion;
await fetch('/api/v1/projects/demo-2/assets/ast-3', { method: 'DELETE' });
const after = (await fetch('/api/v1/projects/demo-2').then((r) => r.json())).scopeVersion;
console.log({ before, after, delta: after - before }); // expect: delta === 1
```

In the UI: compute on `/projects/demo-2/triplets` (no banner) → edit an asset's
ROLFP on `/assets` → return to `/triplets` (amber banner above stats) →
"Recompute now" → banner clears.


---

## Phase 4a — Mitigation Planner (Screen 8)

> **SUPERSEDED by v3 (C8 + C9c).** The v2 mitigation handlers (`GET`/`PATCH
> /triplets/:tid/mitigations`, `GET /mitigations/picker`, `PATCH
> /mitigations/bulk`) and the v2 mitigation UI panel were DELETED in C9c. The
> live v3 model is D3FEND-anchored (`GET`/`PUT /projects/:id/mitigations-v3`,
> severity-recompute residual — see `docs/v3-blueprint.md` C8). The endpoint
> probes below no longer resolve; kept as historical record of the retired v2
> multiplicative-residual contract.

Verifies the 6 new handlers + applicability + residual. Run against `demo-2`
after a Phase 3 compute. New store: `privact_mitigations_v1` (delete + reload to
reset selections).

### 29. Catalog reads

```js
const ctrls = await fetch('/api/v1/catalog/controls').then((r) => r.json());
const cms = await fetch('/api/v1/catalog/countermeasures').then((r) => r.json());
console.log({ controls: ctrls.length, countermeasures: cms.length }); // expect 70, 50
```

### 30. Per-triplet applicable sets + residual

```js
const t = (await fetch('/api/v1/projects/demo-2/triplets?page_size=1').then((r) => r.json())).items[0];
const m = await fetch(`/api/v1/projects/demo-2/triplets/${t.id}/mitigations`).then((r) => r.json());
console.log({
  original: m.originalScore, residual: m.residualScore,
  controls: m.applicableControls.length, cms: m.applicableCountermeasures.length,
  selected: m.selectedControlIds.length + m.selectedCountermeasureIds.length,
});
// expect: residual === original (none selected yet), some applicable controls/cms (≈ 8–18 total)
```

### 31. PATCH selection → residual recompute (multiplicative)

```js
const t = (await fetch('/api/v1/projects/demo-2/triplets?page_size=1').then((r) => r.json())).items[0];
const m = await fetch(`/api/v1/projects/demo-2/triplets/${t.id}/mitigations`).then((r) => r.json());
const two = m.applicableControls.slice(0, 2);
const after = await fetch(`/api/v1/projects/demo-2/triplets/${t.id}/mitigations`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ selectedControlIds: two.map((c) => c.id), selectedCountermeasureIds: [] }),
}).then((r) => r.json());
const expected = Math.max(0, Math.round(m.originalScore * two.reduce((a, c) => a * (1 - c.defaultReduction), 1)));
console.log({ residual: after.residualScore, expected, band: after.residualBand }); // residual === expected
```

### 32. Full-state PATCH is idempotent / replaces

```js
// Re-send empty selection → residual back to original.
const t = (await fetch('/api/v1/projects/demo-2/triplets?page_size=1').then((r) => r.json())).items[0];
const after = await fetch(`/api/v1/projects/demo-2/triplets/${t.id}/mitigations`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ selectedControlIds: [], selectedCountermeasureIds: [] }),
}).then((r) => r.json());
console.log(after.residualScore === after.originalScore); // expect: true
```

### 33. Bulk picker — K of N

```js
const page = await fetch('/api/v1/projects/demo-2/triplets?page_size=5').then((r) => r.json());
const ids = page.items.map((t) => t.id).join(',');
const picker = await fetch(`/api/v1/projects/demo-2/mitigations/picker?type=control&tripletIds=${ids}`).then((r) => r.json());
console.log({ N: picker.selectedTripletCount, items: picker.items.length });
// each item.applicableTripletIds.length is K (1..N); items sorted by K desc; only K≥1 returned
console.log(picker.items.every((bi) => bi.applicableTripletIds.length >= 1));
```

### 34. Bulk apply → updated / skipped

```js
const page = await fetch('/api/v1/projects/demo-2/triplets?page_size=10').then((r) => r.json());
const ids = page.items.map((t) => t.id);
const picker = await fetch(`/api/v1/projects/demo-2/mitigations/picker?type=control&tripletIds=${ids.join(',')}`).then((r) => r.json());
const ctrl = picker.items[0].item.id; // applies to some, maybe not all
const res = await fetch('/api/v1/projects/demo-2/mitigations/bulk', {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ controlId: ctrl, tripletIds: ids }),
}).then((r) => r.json());
console.log({ updated: res.updated.length, skipped: res.skipped.length });
// updated + skipped === ids.length; re-running → all skipped 'already_selected'
```

### 35. List enrichment (residual on the triplets list)

```js
await fetch('/api/v1/projects/demo-2/triplets?page_size=3').then((r) => r.json())
  .then((p) => p.items.map((t) => ({ id: t.id, original: t.riskScore, residual: t.residualScore, count: t.mitigationCount })));
// expect: residualScore present per row; rows with selections show residual < original and count > 0
```

Reset all mitigation selections: delete `privact_mitigations_v1` from
localStorage and reload.

---

## Phase 4b — Dashboard (Screen 9)

> **SUPERSEDED by v3 (C9a + C9c).** The v2 dashboard handlers (`GET
> /risk-heatmap`, `GET /risk-summary/top-residual`) were DELETED in C9c. The v3
> Dashboard reads the LIVE residual model client-side (`useResidualModel`,
> `buildHeatmapV3`) — no dashboard endpoints. The probes below no longer
> resolve; kept as historical record.

Verifies the 2 new endpoints + the risk-summary KPI extension + the /triplets
drill filter. Run against `demo-2` after a Phase 3 compute (and ideally after
applying some mitigations on Screen 8, so residual < original).

### 36. risk-summary KPI extension

```js
await fetch('/api/v1/projects/demo-2/risk-summary').then((r) => r.json());
// expect (existing) total/high/medium/low/lastComputedAt/computedScopeVersion
// PLUS: mitigatedCount, totalReductionPercent (0-100), highResidualCount
```

### 37. Heatmap shape (residual default)

```js
const h = await fetch('/api/v1/projects/demo-2/risk-heatmap').then((r) => r.json());
console.log({ view: h.view, rows: h.rows.length, cols: h.columnTotals.length });
// expect: view 'residual', rows 7 (asset categories), cols 6 (seed threat types)
console.log(h.rows[0].cells[0]); // { threatType, threatTypeLabel, maxScore|null, count, avgScore, mitigatedCount }
```

### 38. Heatmap view toggle (original ≥ residual)

```js
const res = await fetch('/api/v1/projects/demo-2/risk-heatmap?view=residual').then((r) => r.json());
const orig = await fetch('/api/v1/projects/demo-2/risk-heatmap?view=original').then((r) => r.json());
// Pick a cell with triplets; original maxScore >= residual maxScore (mitigations only reduce).
const find = (h) => h.rows.flatMap((row) => row.cells).find((c) => c.maxScore !== null);
console.log({ residualMax: find(res).maxScore, originalMax: find(orig).maxScore });
```

### 39. Row + column totals

```js
const h = await fetch('/api/v1/projects/demo-2/risk-heatmap').then((r) => r.json());
const rowSum = h.rows.reduce((a, r) => a + r.rowTotal, 0);
const colSum = h.columnTotals.reduce((a, c) => a + c.total, 0);
console.log({ rowSum, colSum, equal: rowSum === colSum }); // both === total triplets (75)
```

### 40. Top residual list

```js
const top = await fetch('/api/v1/projects/demo-2/risk-summary/top-residual?limit=10').then((r) => r.json());
console.log(top.length, top.map((t) => t.residualScore));
// expect: 10 rows, residualScore descending; each row enriched (residualScore/residualBand/mitigationCount)
```

### 41. Drill-down filter on /triplets

```js
// Slugs: asset_category from category label, threat_type from threat type label.
await fetch('/api/v1/projects/demo-2/triplets?asset_category=database&threat_type=nefarious_activity&page_size=100')
  .then((r) => r.json())
  .then((p) => console.log(p.total, p.items.every((t) => t.assetCategory === 'Database')));
// expect: only Database × Nefarious-Activity triplets (label match on slugified server side)
```

### 42–45. UI flows (browser)

- **42** Heatmap renders 7×6, band colors match Screens 7/8, empty cells grey "—" non-clickable, hover tooltip shows 4 lines.
- **43** Toggle Residual→Original recomputes cell values (higher in Original).
- **44** Click filled cell → `/triplets?asset_category=…&threat_type=…`, drill banner appears; Clear × removes those params only; Reset clears all.
- **45** Click a top-residual row → `/mitigations?triplet=TR-…` → drawer auto-opens for that triplet, then `?triplet` param disappears from the URL.

---

## Cross-cutting — PhaseNav (Screen 9 commit)

UI/navigation regression checks (browser). No new endpoints.

- **46** Every phase page (`/setup`, `/assets`, `/review`, `/triplets`,
  `/mitigations`, `/dashboard`) renders the PhaseNav strip at the same vertical
  position (after breadcrumb, before title); current phase highlighted navy;
  `aria-current="page"` on it.
- **47** Breadcrumb shows "Projects / {project}" on all pages (no trailing page
  name).
- **48** Clicking a PhaseNav item navigates to the clean phase URL; from
  `/triplets?asset_category=…` → click Dashboard → Triplets → lands on
  `/triplets` with no drill params (fresh state).
- **49** PhaseFooter: Assets/Review/Triplets/Mitigations/Dashboard show
  "← Back to {prev}" (outline) left + "Continue …" (filled) right; Setup has no
  Back; both Back and Continue navigate correctly. Disabled Continue tooltips
  still work.
- **50** Narrow viewport (~800px): the strip scrolls horizontally (no wrap to
  two lines). On `/mitigations`, the sticky bulk action bar still floats above
  the in-flow PhaseFooter without overlap; staleness banner stays below the
  strip, above page content.

---

## Phase 4c — Export (Screen 10)

> **SUPERSEDED by v3 (C9b + C9c).** The v2 export handlers (`GET
> /report-preview`, `/report.json|pdf|xlsx`, `/report.cyclonedx.json`,
> `/report.oscal.json`) were DELETED in C9c. v3 generates every format
> in-browser from the LIVE model (`useResidualModel` + `clientDownloads`,
> CycloneDX/OSCAL via `lib/export/cyclonedxV3` + `oscalV3`) — no export
> endpoints. The probes below no longer resolve; kept as historical record.

Verifies /report-preview aggregation + the 3 download endpoints. Run against
`demo-2` after a Phase 3 compute (ideally with some Phase 4a mitigations).

### 51. Report preview shape

```js
const p = await fetch('/api/v1/projects/demo-2/report-preview').then((r) => r.json());
console.log({
  triplets: p.summary.totalTriplets, assets: p.summary.totalAssets,
  threats: p.threatsInScope.length, vulns: p.vulnsInScope.length,
  topAssets: p.assetInventory.topByImpact.length, topRegister: p.riskRegister.topByResidual.length,
  topMits: p.mitigationsApplied.topByContribution.length, isStale: p.metadata.isStale,
});
// expect: triplets 75, assets 12, top register 20 (truncated true), etc.
```

### 52. Truncation flags

```js
const p = await fetch('/api/v1/projects/demo-2/report-preview').then((r) => r.json());
console.log({ assetTrunc: p.assetInventory.truncated, regTrunc: p.riskRegister.truncated });
// assets 12 → false (≤20); register 75 → true
```

### 53. JSON download = preview payload + headers

```js
const r = await fetch('/api/v1/projects/demo-2/report.json');
console.log(r.headers.get('Content-Disposition')); // attachment; filename="hospital-iot-network-risk-report-YYYY-MM-DD.json"
const body = await r.json();
console.log(body.summary.totalTriplets === 75); // true (same shape as preview)
```

### 54. PDF download is a valid PDF

```js
const r = await fetch('/api/v1/projects/demo-2/report.pdf');
console.log(r.headers.get('Content-Type')); // application/pdf
const buf = new Uint8Array(await r.arrayBuffer());
console.log(String.fromCharCode(...buf.slice(0, 5))); // "%PDF-"
```

### 55. XLSX download is a valid zip/xlsx

```js
const r = await fetch('/api/v1/projects/demo-2/report.xlsx');
console.log(r.headers.get('Content-Type')); // ...spreadsheetml.sheet
const buf = new Uint8Array(await r.arrayBuffer());
console.log(buf[0] === 0x50 && buf[1] === 0x4b); // PK zip magic → true
```

### 56–60. UI flows (browser)

- **56** `/projects/demo-2/export` renders two-column; sidebar 8 items, "Executive Summary" active by default; scroll updates the active item.
- **57** Click a TOC item → smooth-scrolls to that section, not hidden under PhaseNav (scroll-margin).
- **58** Heatmap section renders in the narrower column; Original/Residual toggle works; cell click → /triplets drill.
- **59** Download PDF / XLSX / JSON each save a file with the slug filename and open without error; repeat 5× → no leak, buttons toggle loading.
- **60** New project (no compute) → /export shows ExportEmptyState ("Go to Triplets"); after compute with no mitigations → soft amber banner; terminal footer = Back to Dashboard only (no Continue).

---

## v2 sweep additions (post-v2.0)

These items extend the per-phase sweeps above for the v2 standards-alignment
features. Run them in addition to the original Phase-checklist items when
sweeping any v2-touched screen.

### Standards integration sweep

- **Framework chips render** on every entity carrying a standards reference:
  Vulnerabilities show CWE + CVSS chips in Review / Triplets / Mitigations /
  Export; Threats show ENISA category + Threat Actor chips; Controls show
  NIST CSF function chip XOR CIS Control chip (never both); Countermeasures
  show D3FEND tactic chip only.
- **Hierarchy trees render** on the Catalog Browser (`/catalog`) for each
  domain: CWE-1000 expands Pillar → Class → Base; ENISA expands 12 top →
  25 sub categories; NIST CSF expands Function → Category → Subcategory;
  CIS expands Control → Safeguard; D3FEND expands Tactic → Technique.
- **External links open correctly** — click each external-link icon in
  detail panels; confirms MITRE / CWE / ENISA / NIST URLs resolve and
  open in a new tab. No 404 within the doc URLs the catalogs link to.

### v2 commit 06 — CycloneDX Import sweep

- **Drop a CycloneDX 1.4 file** → resolves to internal entities, imports
  successfully.
- **Drop a CycloneDX 1.5 file** → same.
- **Drop a CycloneDX 1.6 file with `x-privact:rolfp` properties** → ROLFP
  cells populated from the property; no all-zero default.
- **Drop a CycloneDX 1.6 file WITHOUT `x-privact:rolfp`** → ROLFP defaults
  to all zeros; user prompted to edit each asset post-import.
- **Verify side effects** — applicability state cleared, triplets cleared,
  mitigation selections cleared, env + applicability overrides cleared,
  `scopeVersion` bumped. Phase 2 + Phase 3 reflect the fresh state.

### v2 commit 13 — CVSS Environmental sweep

- **Override round-trip** — open any triplet, override base 9.8 with
  unchanged metrics + project-CIA-derived reqs → derived score 9.8 (smoke
  baseline).
- **AV: Network → Local** → score drops to 8.4 (verified offline against
  VU-09).
- **Full override** (AV:L, MUI:P, all impacts Low, reqs Medium) → 3.4 Low,
  formula input 1/5.
- **`★` marker** appears on the TripletsTable row score cell + modal footer.
- **OSCAL export** — confirm the active override's `risks[*]` entry has a
  third `characterizations[]` block with `cvss-environmental-score` +
  `cvss-environmental-severity` facets.

### v2 commit 14 — Per-Asset Applicability sweep

- Phase 2 Review → third tab (Per-Asset Applicability) loads.
- Select an asset, override a threat → row badge flips to "Overridden";
  effective state badge updates.
- **Save & recompute** → triplet count adjusts in Phase 3 (mark a normally-
  applicable threat as not-applicable on one asset → count drops by N).
- **Mark a normally-not-applicable threat as applicable** on one asset →
  triplet count grows for that asset (also verify in CycloneDX export the
  `x-privact:applicability-overrides` property on the project component).
- **Override revert** — reset overrides → triplet count returns to baseline.
- **OSCAL export** — confirm one EXAMINE Observation per override with
  `x-privact:override-{asset-id,type,item-id,state}` props.

### v2 commit 12 — OSCAL export sweep

- `GET /projects/:id/report.oscal.json` downloads.
- File MIME: `application/oscal.assessment-results+json`.
- File contains `metadata` + `parties` + `observations[]` (12 from assets +
  services on demo-2; +N from applicability overrides) + `risks[]` (75) +
  `findings[]` (46 high-band) + `x-privact:*` methodology props on project +
  triplet entries.

### v2 commit 11 — Catalog Browser sweep

- `/catalog` route renders without authentication redirect.
- 4 domain tabs render: Assets, Vulnerabilities, Threats, Actions.
- Sub-tabs render where applicable (Threats: ENISA+STIX; Actions: NIST+CIS+D3FEND).
- Tree expand/collapse smooth on each domain.
- Search input filters tree.
- Detail panel updates on tree click.
- Usage stats display correctly (scan seed data references).

