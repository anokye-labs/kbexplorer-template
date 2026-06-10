---
id: "node-types"
title: "Open Node-Type Foundation"
emoji: "Shapes"
cluster: engine
derived: true
connections: []
---

The node-type foundation (issue [#148](https://github.com/anokye-labs/kbexplorer-template/issues/148)) turns kbexplorer into an **open, data-driven node-type engine**. New node types — a person, a team, a service — register themselves at runtime instead of forcing edits to the core [type contract](identity). Every change is **additive and backward-compatible**: a node that omits the new fields behaves exactly as before.

## JSON-LD on `KBNode`

Each `KBNode` may carry three optional, additive fields:

```typescript
interface KBNode {
  // …existing fields…
  entityType?: string;               // open registry key, e.g. 'person' | 'team'
  jsonld?: JsonLd;                   // { '@context', '@id', '@type', …LD props }
  data?: Record<string, unknown>;    // free-form structured-data bag
}
```

`@id` reuses the node's canonical `identity` URN so representations of the same real-world entity line up across providers, and `@type` is the open node-type discriminator — it is **never derived from a file path**. Build an envelope with `buildJsonLd(node, type, data?, context?)`, which defaults `@context` to `https://schema.org` and falls back to a `kg://node/<id>` `@id` when the node has no identity.

## Open unions

`DisplayMode` and `EdgeType` are **open** unions — `KnownDisplayMode | (string & {})` — so new render modes and structural edge kinds keep editor autocomplete for known values while allowing arbitrary new ones. `'entity'` is the display-mode escape hatch that routes a node to a viewer.

`NodeSource` is opened differently, on purpose: rather than widening it (which would break the exhaustive `switch` narrowing in `SourceBadge` and the identity system), it gains **one** generic variant:

```typescript
| { type: 'structured'; entityType: string; ref?: string }
```

A brand-new node type therefore never adds a `NodeSource` variant — it uses `source: { type: 'structured', entityType: 'person' }` and identifies itself through the node-type registry.

## Relation taxonomy

Edges carry an optional, open `relation` label (on both `KBEdge` and `Connection`) that is orthogonal to the structural `type`. The six core relations are `leads`, `staffs`, `reports-to`, `structural`, `derived`, and `deprecated`. Styling is centralised so the [graph renderer](graph-engine) and the legend never drift apart:

- `getEdgeStyle(edge)` — relation (known → `RELATION_STYLES`; unknown → default style + humanized label) → `type` → `related`.
- `getEdgeLegendKey(edge)` — the relation when present, else the type.
- `getEdgeWeight(type)` — open-safe layout weight lookup.

The HUD legend is rendered data-drivenly from the relations/types actually present in the visible graph.

## Node-type registry

`src/engine/node-types` is the registry that makes types data-driven:

```typescript
registerType({ id: 'person', layer: 'work', cluster: 'org', viewer: 'person' });
resolveType(id); hasType(id); getRegisteredTypes();
resolveNodeLayer(node); resolveTypeCluster(node); resetNodeTypeRegistry();
```

`getNodeLayer()` delegates to `resolveNodeLayer` (precedence: `entityType` definition → `source.type` definition → `'file'`). Built-in source types are pre-registered with their historical layer mapping, so existing graphs classify identically.

## Viewer registry

`src/views/viewers` maps an `entityType` (or JSON-LD `@type`) to a React renderer:

```typescript
registerViewer('person', PersonView);
const Viewer = resolveViewer(node);   // PersonView, or the generic fallback
```

`resolveViewer` resolves by `entityType` first, then JSON-LD `@type`, and finally the mandatory `GenericStructuredView` — which renders any `data`/`jsonld` object as a nested table/tree, so coverage is never zero. In `ReadingView`, `display: 'entity'` resolves a viewer and `SourceBadge` renders the `structured` source.

## Adding a new node type (the F2/F3 recipe)

1. `registerType({ id: 'service', layer: 'work', cluster: 'infra', viewer: 'service' })`.
2. Emit nodes with `source: { type: 'structured', entityType: 'service' }`, `display: 'entity'`, and a `jsonld`/`data` payload (use `buildJsonLd`).
3. Optionally `registerViewer('service', ServiceView)` — otherwise the generic viewer is used.
4. Connect nodes with `relation`-tagged edges from the taxonomy.

No edits to the core unions or render switches are required.

## Operational notes

- `CACHE_VERSION` in `src/api/github.ts` is bumped whenever the cached node/edge shape changes (the JSON-LD fields bumped it to **13**); stale caches self-clear on load.
- An off-by-default demo seam, `injectDemoEntities()` (enabled via `?demo=entities` or `localStorage['kbe-demo-entities']`), seeds person/team entities and `leads`/`staffs`/`reports-to` edges for end-to-end verification without polluting real graphs.
