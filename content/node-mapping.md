---
id: "node-mapping"
title: "Node Mapping"
emoji: "Map"
cluster: engine
derived: true
connections: []
---

The node mapping system (`src/engine/nodemap.ts`) defines how source files become graph nodes via the `nodemap.yaml` configuration file. This is the bridge between the raw repository file system and the curated knowledge graph — without it, the graph would either show every file (overwhelming) or require manual content authoring for each node (unscalable). It was designed in [#41](https://github.com/anokye-labs/kbexplorer-template/issues/41) and implemented in commit `611e138`.

## Five Processing Modes

Each `nodemap.yaml` entry specifies a mode that determines how files map to nodes:

1. **Single file** — one file becomes one node (e.g., `src/engine/graph.ts` → `graph-engine`)
2. **Split** — one file is split at `##` headings into parent + section nodes via the [parser](parser)'s `splitIntoSections()`
3. **Merge** — multiple files combine into a single node
4. **Glob** — a pattern like `src/engine/*.ts` creates one node per matching file
5. **Directory** — a directory listing becomes a navigable tree node

```yaml
# nodemap.yaml example — single file mode
- id: graph-engine
  title: Graph Engine
  file: src/engine/graph.ts
  emoji: Flash
  cluster: engine
  connections: imports
```

## Connection Derivation

After processing all entries, `deriveConnections()` makes a second pass to add edges. The `connections` field in each entry supports three strategies:

- **Explicit array** — `[graph-engine, parser]` directly lists target node IDs
- **`imports`** — `extractImportPaths()` parses `import`/`require` statements from source code, `resolveImportPath()` resolves relatives like `../types`, and each match becomes an edge
- **`references`** — scans content for inline links to other node IDs

## I/O Abstraction

The module is standalone — callers provide `readFile`, `listFiles`, and `listDirectory` callbacks. This lets it work with both the [GitHub API](github-api) (remote mode) and the pre-built manifest (via the [local loader](local-loader)) without any filesystem dependency.

## Integration

The [local loader](local-loader) and [authored provider](authored-provider) both call `loadNodeMap()` with raw YAML and I/O callbacks. The [node mapping spec](spec-node-mapping) documents the full schema. The [multi-layer identity](multi-layer-identity) system connects nodemap file entries to content nodes via `urn:file:` identity URNs in the [identity system](identity). The provider architecture ([#40](https://github.com/anokye-labs/kbexplorer-template/issues/40)) uses node mapping as the foundation layer defined in the [type system](type-system).
