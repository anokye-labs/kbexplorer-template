# Graph Provider Architecture

## Problem

kbexplorer currently loads all graph data through a single monolithic pipeline:
manifest script → parser → graph builder. All data sources (files, issues, PRs,
commits, authored content) are mixed together in one pass. This creates several
problems:

1. **All-or-nothing loading** — can't add a data source without rebuilding everything
2. **No selective depth** — can't say "give me 5 commits per file but expand on demand"
3. **No external sources** — can't pull from org directories, external APIs, other repos
4. **No caching granularity** — the entire manifest is one blob, rebuilt from scratch
5. **No graph layering** — can't show "just files" or "files + issues" as separate views

## Solution: Provider-Based Graph System

A layered architecture where **providers** contribute nodes and edges to a
unified graph, with **prescribed resolution depth**, **caching**, and
**view projections** over the combined graph.

```
┌──────────────────────────────────────────────────────────┐
│                     Graph Views                          │
│  "Code Structure"  "Work Items"  "Full Graph"  custom... │
│  (files+dirs)      (issues+PRs)  (all providers)         │
└────────────────────────┬─────────────────────────────────┘
                         │ projection / filter
┌────────────────────────┴─────────────────────────────────┐
│                   Unified Graph Store                     │
│  Append-only node/edge store with provider attribution    │
│  Local cache (SQLite, versioned, queryable)               │
└────┬────────┬─────────┬──────────┬───────────┬───────────┘
     │        │         │          │           │
┌────┴──┐ ┌───┴───┐ ┌───┴──┐ ┌────┴───┐ ┌─────┴─────┐
│ Files │ │  Git  │ │GitHub│ │Authored│ │ External  │
│Provider│ │Provider│ │Provider│ │Provider│ │ Provider │
│       │ │       │ │       │ │       │ │(org,API..)│
└───────┘ └───────┘ └───────┘ └───────┘ └───────────┘
```

## Core Concepts

### Provider

A provider is a module that contributes nodes and edges to the graph.

```typescript
interface GraphProvider {
  id: string;
  name: string;
  nodeTypes: string[];

  /** What this provider needs to run (e.g., '.git', 'gh cli', 'network') */
  requires: string[];

  /** Resolution depth configuration */
  resolution: {
    default: ResolutionPreset;
    presets: Record<string, ResolutionPreset>;
  };

  /** Produce initial nodes/edges at the prescribed depth */
  resolve(context: ProviderContext): Promise<ProviderResult>;

  /** Expand a specific node on demand */
  expand?(nodeId: string, context: ProviderContext): Promise<ProviderResult>;

  /** Patterns that trigger this provider based on existing graph state */
  triggers?: TriggerPattern[];
}

interface ResolutionPreset {
  name: string;
  description: string;
  limits: Record<string, number>;
  // e.g., { commitsPerFile: 5, maxFiles: 500, branchDepth: 0 }
}

interface ProviderContext {
  cwd: string;
  config: KBConfig;
  existingNodes: GraphNode[];
  cache: GraphCache;
  resolution: ResolutionPreset;
}

interface ProviderResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  expandable: ExpandableRef[];
}
```

### Graph Node (Extended)

```typescript
interface GraphNode {
  id: string;
  type: string;              // 'file', 'commit', 'issue', 'pr', 'authored', ...
  provider: string;          // which provider created this node
  title: string;
  content: string;
  rawContent: string;
  cluster: string;
  icon: string;              // Fluent UI icon name
  parent?: string;
  connections: Connection[];
  meta: Record<string, unknown>;

  /** Expansion state */
  expandable?: boolean;
  expanded?: boolean;
  depth: number;             // 0 = summary, higher = more detail

  /** Cache management */
  resolvedAt: string;
  expiresAt?: string;
}
```

### Graph Edge (Extended)

```typescript
interface GraphEdge {
  from: string;
  to: string;
  type: string;              // 'contains', 'references', 'modifies', 'blocks', ...
  provider: string;
  description: string;
  weight?: number;
  meta?: Record<string, unknown>;
}
```

### Expandable Reference

```typescript
interface ExpandableRef {
  nodeId: string;
  provider: string;
  hint: string;              // e.g., "47 more commits available"
  estimatedNodes: number;
}
```

## Providers

### 1. Files Provider (`files`)

**Produces**: `directory`, `file` nodes; `contains` edges
**Requires**: file system access
**Resolution presets**:

| Preset | Behavior |
|--------|----------|
| `summary` | Top-level dirs + key files (≤50 nodes) |
| `standard` | All dirs + files with key extensions (≤500 nodes) |
| `full` | Every file in the repo |

**Triggers**: Always runs (base layer)

### 2. Git Provider (`git`)

**Produces**: `commit`, `branch`, `tag` nodes; `modifies` edges
**Requires**: `.git` directory
**Resolution presets**:

| Preset | Behavior |
|--------|----------|
| `summary` | Last 5 commits per file, no branches |
| `standard` | Last 20 commits per file, active branches |
| `full` | Full git log, all branches and tags |

**Triggers**: When `file` nodes exist
**On-demand**: Click a file → load its full commit history

### 3. GitHub Provider (`github`)

**Produces**: `issue`, `pull_request` nodes; `references`, `closes` edges
**Requires**: `gh` CLI or GitHub API token
**Resolution presets**:

| Preset | Behavior |
|--------|----------|
| `summary` | Open issues + recent 10 PRs, no file lists on PRs |
| `standard` | All issues + all PRs, PR→commit links, max 5 commits per PR |
| `full` | Everything including closed items, full file lists |

**Triggers**: When git remote is `github.com`
**On-demand**: Click a PR → load its file list and commit history

### 4. Azure DevOps Provider (`azdo`) [future]

**Produces**: `work_item`, `pull_request` nodes; `linked_to` edges
**Requires**: `az` CLI or ADO API token
**Triggers**: When git remote is `dev.azure.com`

### 5. Authored Content Provider (`authored`)

**Produces**: `authored` nodes with frontmatter-defined connections
**Requires**: content directory with `.md` files
**Resolution presets**:

| Preset | Behavior |
|--------|----------|
| `summary` | Frontmatter only (id, title, cluster, connections — no body) |
| `standard` | Full content |

**Triggers**: When `content/` directory exists or config specifies a path

### 6. Projection Provider (`projection`)

**Produces**: Synthetic nodes derived from existing graph state
**Requires**: Other providers to have run
**Examples**:
- "Hot files" — files touched by the most commits
- "Stale issues" — issues not updated in 30+ days
- "Coupling clusters" — files that always change together

**Triggers**: After all other providers resolve

### 7. External Provider (`external`) [future]

**Produces**: Arbitrary nodes from external APIs
**Requires**: Network + configured endpoint
**Examples**: org chart, Jira items, Confluence pages
**Resolution**: On-demand only

## Provider Resolution Order

Providers run in dependency order based on triggers:

```
Layer 0: files (always)
Layer 1: git (needs file nodes), authored (needs content dir)
Layer 2: github/azdo (needs git remote), projection (needs all)
Layer 3: external (on-demand only)
```

Within a layer, providers run in parallel.

## Trigger System

Providers declare interest based on existing graph state:

```typescript
interface TriggerPattern {
  requiredNodeTypes: string[];
  nodeMatch?: Record<string, string>;
  description: string;
}
```

Example: GitHub provider triggers when file nodes exist with
`meta.remoteHost === 'github.com'`.

## Graph Store

Append-only SQLite database at `.kbexplorer/graph.db` (gitignored).

### Schema

```sql
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  raw_content TEXT,
  cluster TEXT,
  icon TEXT,
  parent TEXT,
  meta TEXT,                   -- JSON
  expandable BOOLEAN DEFAULT 0,
  expanded BOOLEAN DEFAULT 0,
  depth INTEGER DEFAULT 0,
  resolved_at TEXT NOT NULL,
  expires_at TEXT
);

CREATE TABLE edges (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  description TEXT,
  weight REAL DEFAULT 1.0,
  meta TEXT,
  resolved_at TEXT NOT NULL
);

CREATE TABLE provider_state (
  provider TEXT PRIMARY KEY,
  last_run TEXT,
  resolution TEXT,
  node_count INTEGER,
  edge_count INTEGER,
  meta TEXT
);

CREATE TABLE expandable (
  node_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  hint TEXT,
  estimated_nodes INTEGER,
  PRIMARY KEY (node_id, provider)
);

CREATE INDEX idx_nodes_type ON nodes(type);
CREATE INDEX idx_nodes_provider ON nodes(provider);
CREATE INDEX idx_edges_from ON edges(from_id);
CREATE INDEX idx_edges_to ON edges(to_id);
CREATE INDEX idx_edges_type ON edges(type);
```

### Storage Investigation Notes

**Dolt** (Git-for-data SQL): Versioned tables with branch/merge/diff. Could
enable graph state diffing between runs. Heavy dependency (requires Dolt binary).
Consider for future if versioned graph diffing becomes valuable.

**Beads**: Lightweight data versioning with Git semantics. Less queryable than SQL.
Consider for reproducible graph snapshots.

**Decision**: Start with SQLite. Schema designed for potential Dolt migration
(nodes/edges as tables with provider/timestamp columns). The versioning insight
from Dolt informs the `resolved_at` / `provider_state` tracking.

## Graph Views

Named projections over the graph:

```typescript
interface GraphView {
  id: string;
  name: string;
  description: string;
  providers?: string[];        // which providers to include
  nodeTypes?: string[];        // which node types to show
  edgeTypes?: string[];        // which edge types to show
  clustering?: 'provider' | 'type' | 'directory' | 'label' | 'custom';
  layout?: 'force' | 'hierarchical' | 'radial' | 'timeline';
}
```

### Built-in Views

| View | Providers | Node Types | Layout |
|------|-----------|------------|--------|
| Code Structure | files | file, directory | hierarchical |
| Work Items | github/azdo | issue, pull_request | force |
| Git History | git | commit, branch, tag | timeline |
| Documentation | authored | authored | force |
| Full Graph | all | all | force |
| Hot Spots | projection | hot_file, coupled_files | force |

## Resolution Depth Configuration

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
      maxPRs: 20
      prFileList: false
      prCommits: 5
  authored:
    resolution: standard
```

## File-to-N-Nodes Mapping

Some providers produce multiple nodes from a single source:

- **Authored**: 1 markdown file → 1 parent node + N section nodes (splitting at `##` headings)
- **Git**: 1 file → N commit nodes (each commit that touched it)
- **Projection**: N existing nodes → 1 synthetic cluster node

This is handled by the provider's `resolve` function — it controls how many
nodes a single source entity produces.

## Implementation Phases

| Phase | What | Providers |
|-------|------|-----------|
| 1 | Provider interface + graph store + base providers | files, authored |
| 2 | Git provider with depth limits + on-demand expansion | git |
| 3 | GitHub provider with on-demand PR expansion | github |
| 4 | Projection provider + custom views | projection |
| 5 | External provider plugin system | external |
