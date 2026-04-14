---
id: "spec-link-assessment"
title: "Link Assessment Spec"
emoji: "LinkSquare"
cluster: design
derived: true
connections: []
---

The link assessment specification defines how the quality and health of the knowledge graph's connections are evaluated. Added in commit `9ed4d1e` alongside the [multi-layer identity spec](multi-layer-identity).

## Five Assessment Dimensions

1. **Connectivity** — average links per node (target: 4-8). Too few = disconnected islands; too many = hairball
2. **Cluster balance** — standard deviation of cluster sizes. Wildly unbalanced clusters produce lopsided layouts
3. **Link density** — ratio of actual edges to possible edges (target: 0.1-0.3). Too dense is unreadable; too sparse is fragmented
4. **Bidirectionality** — percentage of edges with a reciprocal edge. Higher reciprocity = better cross-linking
5. **Content depth** — average content length per node. Short nodes add structural noise without understanding

## The Assessment Script

The [build scripts](build-scripts) include `assess-graph.js`:

```bash
node scripts/assess-graph.js
# Reads content/*.md, extracts inline links, builds graph, scores quality
```

It checks for orphan nodes (0 incoming links), hub reachability (BFS from highest-degree node), and high out-degree hubs. All checks produce suggestions — the script never fails.

## Thresholds

| Metric | Good | Warning |
|--------|------|---------|
| Nodes per view | ≤ 50 | > 50 |
| Edges per view | ≤ 100 | > 100 |
| Clusters | ≤ 8 | > 8 |
| Hub hops | ≤ 3 | > 3 |
| High out-degree | < 15 | ≥ 15 |

## Integration

Runs after content derivation via the [catalogue transformer](catalogue-transformer). The [inline link extraction](inline-link-extraction) spec defines how links become edges. The [content pipeline](content-pipeline) produces the content that gets assessed. The [design decisions](design-decisions) node covers the broader rationale.
