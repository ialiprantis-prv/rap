# Cascading (Propagated) Risk

Cascading risk is an additive layer introduced in V4. It does not change the triplet
formula or any factor defined in `methodology-kernel.md`. It computes how a compromise
on one asset propagates to assets that depend on it, along dependency edges, using
per-CIA transmission coefficients.

Cascading risk is required by the AENAON Grant Agreement (GA Objective 5). Decision D-1
assigns both individual and cascading risk computation to the RAP; the TDIR platform
consumes the results and does not recompute them.

---

## Dependency graph

Nodes are assets. Edges come from two sources:
1. Containment and host links derived from the BOM and asset `parent_ref` fields.
2. Analyst-added explicit edges (data-flow, authentication, network/hosting).

Edge types: `hosted-on / runs-on`, `reads-data-from`, `authenticates-via`, `depends-on`.

Direction of propagation: depended-upon (upstream) to dependents (downstream).
An edge `A -> B` means A supports or hosts B; risk propagates from A to B.

---

## Transmission coefficient (tau)

Each edge carries a transmission coefficient tau in [0, 1], one value per CIA dimension
(tau_C, tau_I, tau_A). The coefficient represents how much of the source asset's risk
passes through the edge to the dependent asset.

Tau defaults by edge type (non-authoritative starting values, overridable by the analyst):

| Edge type | tau_C | tau_I | tau_A |
|---|---|---|---|
| hosted-on / runs-on | 0.3 | 0.4 | 0.8 |
| reads-data-from | 0.9 | 0.8 | 0.3 |
| authenticates-via | 0.8 | 0.8 | 0.4 |
| depends-on (generic) | 0.5 | 0.5 | 0.5 |

Tau is overridable per edge and per CIA dimension. Edges with tau_d = 0 are dropped from
propagation for dimension d.

---

## Source risk per asset

The asset-level source risk for a source asset S and dimension d is:

```
Risk_d(S) = max over all in-scope triplets of S of Risk_d
```

Out-of-scope triplets do not contribute to source risk and do not propagate.

---

## Cascading risk propagation

For each target asset T and dimension d:

```
CascadingRisk_d(T) = max over all upstream source assets S that reach T of:
    [ Risk_d(S) x product of tau_d(edges on the path S -> ... -> T) ]
```

Implementation: this is a max-product path problem. Compute it as a shortest-path on
edge weights of -log(tau_d), which transforms the max-product into a min-sum problem
(standard Dijkstra or DFS). Drop edges where tau_d = 0. Handle cycles by tracking
visited nodes per traversal and treating the graph as a reachability DAG (cap path
length or detect revisits to prevent infinite loops).

---

## Total risk

For each target asset T and dimension d:

```
Total_d(T) = min(80, max(IndividualRisk_d(T), CascadingRisk_d(T)))
```

Cascading risk is computed on both raw risk and residual risk. When computed on residual
risk, the source risk used is the residual Risk_d(S) from each source asset's triplets.

---

## Contributing paths and explainability

For each (asset, dimension) result, the system records the contributing path: which source
asset, which edges (with tau values), and the attenuated value after multiplication. This
path is stored in the CascadingResult and exposed in the API, the cascading screen, and
exports.

A single (T, d) result may be the maximum of several candidate paths; record the winning
path.

---

## Acceptance test (worked example)

This example must pass as an engine unit test.

Host asset "Edge Node" has Risk_A = 30 (from its in-scope triplets).

Edge: Edge Node ->(hosted-on)-> Data Manager, with tau_A = 0.8.

```
CascadingRisk_A(Data Manager) = 30 x 0.8 = 24
```

If Data Manager's own IndividualRisk_A = 10:

```
Total_A(Data Manager) = min(80, max(10, 24)) = 24
```

Contributing path: [Edge Node ->(hosted-on, tau_A=0.8)-> Data Manager, attenuated value 24].

---

## Implementation notes

- The engine computes cascading in the `engine/` package (shared TypeScript), server-side
  and authoritative. The frontend displays results from the API; it does not recompute.
- The cascading graph is built from the adjacency of DependencyEdge records plus the
  BOM-derived parent_ref containment links.
- An in-memory adjacency-list implementation is sufficient for V1. A graph database is
  not required.
- The cascading screen (placed after Mitigations in the UI) allows the analyst to view
  the dependency graph, edit tau values per edge, and inspect contributing paths. Changes
  to tau trigger a server-side recompute.
