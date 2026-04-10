---
id: "spec-graph-store"
title: "Graph Store + Provider Interface"
emoji: "Database"
cluster: design
connections:
  - to: "spec-providers-overview"
    description: "part of"
  - to: "spec-node-mapping"
    description: "consumes"
  - to: "spec-views"
    description: "enables"
---
# Graph Store + Provider Interface

## Problem

After node mapping (spec 01) gives us flexible file→node projection,
we need:

1. A **persistent cache** so nodes don't need to be re-derived every time
2. A **provider interface** so different data sources (files, git, GitHub)
   are pluggable
3. **Provider attribution** so we know which provider created each node
4. **Resolution depth tracking** so we know what's been resolved and what's expandable

## Solution: SQLite Graph Store + Provider Interface

### Graph Store

SQLite database at `.kbexplorer/graph.db` (gitignored). Append-only with
provider attribution. Each node/edge records who created it and when.

```sql
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,           -- 'file', 'commit', 'issue', 'authored', ...
  provider TEXT NOT NULL,       -- 'files', 'git', 'github', 'authored', ...
  title TEXT NOT NULL,
  content TEXT,
  raw_content TEXT,
  cluster TEXT,
  icon TEXT,
  parent TEXT,
  display TEXT,                 -- 'prose', 'code', 'tree', 'table', ...
  meta TEXT,                    -- JSON: provider-specific metadata
  expandable BOOLEAN DEFAULT 0,
  expanded BOOLEAN DEFAULT 0,
  depth INTEGER DEFAULT 0,
  resolved_at TEXT NOT NULL,
  expires_at TEXT
);

CREATE TABLE edges (
  id TEXT PRIMARY KEY,          -- canonical: min(from,to)|max(from,to)|type
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  type TEXT NOT NULL,           -- 'contains', 'imports', 'references', 'modifies', ...
  provider TEXT NOT NULL,
  description TEXT,
  weight REAL DEFAULT 1.0,
  meta TEXT,
  resolved_at TEXT NOT NULL
);

CREATE TABLE provider_state (
  provider TEXT PRIMARY KEY,
  last_run TEXT,
  resolution TEXT,              -- preset name
  node_count INTEGER,
  edge_count INTEGER,
  config_hash TEXT,             -- hash of provider config for change detection
  meta TEXT
);

CREATE TABLE expandable (
  node_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  hint TEXT,
  estimated_nodes INTEGER,
  PRIMARY KEY (node_id, provider)
);
```

### Provider Interface

```typescript
interface GraphProvider {
  id: string;
  name: string;
  nodeTypes: string[];
  requires: string[];          // prerequisites: '.git', 'gh', 'network'

  resolution: {
    default: string;           // preset name
    presets: Record<string, ResolutionPreset>;
  };

  resolve(ctx: ProviderContext): Promise<ProviderResult>;
  expand?(nodeId: string, ctx: ProviderContext): Promise<ProviderResult>;
  triggers?: TriggerPattern[];
}
```

### Resolution Presets

Per-provider depth limits defined in config:

```yaml
providers:
  files:
    resolution: standard
  git:
    resolution: summary
    limits:
      commitsPerFile: 5
      branches: false
  github:
    resolution: summary
    limits:
      maxIssues: 50
      prFileList: false
```

### Provider Execution Order

Providers run in layers based on triggers:

```
Layer 0: files (always), authored (if content/ exists)
Layer 1: git (if .git exists)
Layer 2: github (if remote is github.com)
Layer 3: projection (after all others)
```

### Storage Notes

**Why SQLite**: Zero install, queryable, file-based, well-understood.
Schema designed so it could migrate to Dolt (versioned SQL) later
if graph-state diffing becomes valuable. The key Dolt insight is the
`resolved_at` / `provider_state` tracking — this gives us cache
invalidation and incremental updates.

**Cache invalidation**: Each provider stores a `config_hash` in
`provider_state`. If the config changes, the provider re-resolves.
Individual nodes have `expires_at` for time-based expiry.

### Transition Path

The graph store wraps around the existing pipeline:

```
Current:
  parser.ts → KBNode[] → buildGraph → KBGraph → render

With store:
  parser.ts → KBNode[] → store.upsert() → store.query() → KBGraph → render
  providers  → KBNode[] → store.upsert() ↗
```

The store is a caching layer. Providers populate it. The UI reads from it.
The existing `parser.ts` functions become the internals of the files/authored
providers.
