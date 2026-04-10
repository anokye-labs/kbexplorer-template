---
id: "spec-node-mapping"
title: "Node Mapping — How Files Become Nodes"
emoji: "Diagram"
cluster: design
connections:
  - to: "spec-providers-overview"
    description: "part of"
  - to: "spec-graph-store"
    description: "feeds into"
---
# Node Mapping — How Files Become Nodes

## Problem

kbexplorer has two rigid modes:
- **Authored**: 1 markdown file with frontmatter → 1 node
- **Repo-aware**: issues/tree/README auto-mapped by hardcoded logic

There's no way to say:
- "This specific `.ts` file should become a node displayed as a component diagram"
- "These 3 files together represent one concept node"
- "This large markdown file should become 5 nodes"
- "Show this file's content as a table, not as prose"

## Solution: Node Map

A `nodemap.yaml` file (or section in `config.yaml`) that defines how
files in the repo map to graph nodes. This is the projection layer.

### Basic Structure

```yaml
# nodemap.yaml — how files become nodes
nodes:
  # 1 file → 1 node (simplest case)
  - id: architecture
    file: docs/architecture.md
    title: "System Architecture"
    icon: Building
    cluster: architecture

  # 1 file → N nodes (split by headings)
  - id: api-reference
    file: docs/api.md
    split: headings       # split at ## headings → parent + section nodes
    cluster: api

  # N files → 1 node (merge)
  - id: config-system
    files:
      - src/config/defaults.ts
      - src/config/schema.ts
      - src/config/loader.ts
    title: "Configuration System"
    icon: Settings
    cluster: engine
    display: file-list    # show as a list of files, not prose

  # File with custom display
  - id: database-schema
    file: prisma/schema.prisma
    title: "Database Schema"
    icon: Database
    cluster: data
    display: code          # render as syntax-highlighted code, not markdown

  # Glob pattern → multiple nodes
  - id: components
    glob: src/components/**/*.tsx
    each: file             # each matching file becomes its own node
    cluster: ui
    icon: PuzzlePiece
    titleFrom: filename    # node title derived from filename

  # Directory as a single node with file listing
  - id: test-suite
    directory: tests/
    title: "Test Suite"
    icon: Beaker
    cluster: testing
    display: tree          # show as a file tree
```

### Mapping Modes

| Mode | Config Key | What It Does |
|------|-----------|-------------|
| **Single file** | `file:` | 1 file → 1 node. Content rendered as markdown/code. |
| **Split** | `file:` + `split: headings` | 1 file → parent + N section nodes at `##` headings. |
| **Merge** | `files:` (array) | N files → 1 node. Content concatenated or listed. |
| **Glob** | `glob:` + `each: file` | Pattern → N nodes, one per matching file. |
| **Directory** | `directory:` | Directory → 1 node showing file tree. |

### Display Modes

How a node's content is presented in the reading view:

| Display | Rendering |
|---------|-----------|
| `prose` | Markdown → HTML (default for .md files) |
| `code` | Syntax-highlighted source code |
| `file-list` | List of files with paths and sizes |
| `tree` | Directory tree visualization |
| `table` | Parsed as table (for CSV/TSV/structured data) |
| `diagram` | Mermaid diagram from content |

### Connection Derivation

Connections between mapped nodes can be:

1. **Explicit** — declared in `nodemap.yaml`:
   ```yaml
   connections:
     - to: other-node
       description: "depends on"
   ```

2. **Import-based** — auto-derived from `import` statements in source files:
   ```yaml
   connections: imports    # scan file for import statements → edges
   ```

3. **Reference-based** — auto-derived from content mentions:
   ```yaml
   connections: references  # scan content for mentions of other node titles
   ```

### Relationship to Authored Content

`nodemap.yaml` and `content/*.md` coexist:

- **Authored** content (frontmatter .md files) continues to work as before
- **Node map** entries can override or supplement authored nodes
- If a node map entry has `file:` pointing to a `content/*.md` file,
  it uses the frontmatter but the node map can override cluster/icon/display
- Node map can reference files OUTSIDE `content/` — that's the main point

### Relationship to Providers (Future)

In the full provider architecture, `nodemap.yaml` becomes the configuration
for the **Files Provider** and **Authored Provider**. Each mapping mode
corresponds to a resolution strategy within the provider.

But the node map works NOW, before any provider system exists. It's a
config-driven way to control the existing parser output.

## Implementation

### Where It Fits

```
config.yaml                 nodemap.yaml
    │                           │
    └──────────┬────────────────┘
               ↓
          parser.ts (enhanced)
          - reads nodemap.yaml
          - for each entry: reads file(s), applies mapping mode
          - produces KBNode[] with correct display/cluster/connections
               ↓
          graph.ts (unchanged)
               ↓
          views (enhanced for display modes)
```

### Changes to Existing Code

1. **`parser.ts`**: Add `loadNodeMap()` function that reads `nodemap.yaml`
   and produces `KBNode[]` using the mapping modes
2. **`KBNode`**: Add `display?: 'prose' | 'code' | 'file-list' | 'tree' | 'table' | 'diagram'`
3. **`ReadingView`**: Render content differently based on `display` mode
4. **`config.yaml`**: Add optional `nodemap:` section (or standalone file)

### What Stays the Same

- Authored `content/*.md` files continue to work
- `loadRepoContent()` continues to produce issue/tree/README nodes
- `buildGraph()` is unchanged — it just receives more/different nodes
- The graph store (future) will consume the same `KBNode[]` output

## Example: Applying to kbexplorer Itself

```yaml
# nodemap.yaml for kbexplorer-template
nodes:
  # Main app entry — show as architecture diagram
  - id: app-entry
    file: src/App.tsx
    title: "Application Shell"
    icon: Apps
    cluster: ui
    connections: imports

  # Engine modules — each .ts file becomes a node
  - id: engine
    glob: src/engine/*.ts
    each: file
    cluster: engine
    icon: Flash
    connections: imports
    exclude: [index.ts, __tests__]

  # API client — merge into one node
  - id: api-client
    files: [src/api/github.ts, src/api/index.ts]
    title: "GitHub API Client"
    icon: PlugConnected
    cluster: data

  # Styles — directory overview
  - id: styles
    directory: src/styles/
    title: "CSS System"
    icon: PaintBrush
    cluster: visual
    display: tree

  # README split into sections
  - id: readme
    file: README.md
    split: headings
    cluster: docs
    icon: Book
```
