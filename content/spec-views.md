---
id: "spec-views"
title: "Views, Expansion, and External Providers"
emoji: "Eye"
cluster: design
connections:
  - to: "spec-providers-overview"
    description: "run phase of"
  - to: "spec-graph-store"
    description: "queries graph store from"
  - to: "hud"
    description: "adds view selector to"
  - to: "overview-view"
    description: "replaces single view with projections in"
  - to: "reading-view"
    description: "adds expandable nodes to"
  - to: "graph-network"
    description: "adds view-filtered rendering to"
  - to: "graph-engine"
    description: "adds view projection layer above"
  - to: "github-api"
    description: "moves into GitHub provider from"
  - to: "issue-43"
    description: "GitHub provider tracked by"
  - to: "issue-44"
    description: "views tracked by"
  - to: "issue-45"
    description: "external providers tracked by"
---
---
# Views, On-Demand Expansion, and External Providers

## Graph Views

Views are named projections — filters over the unified graph that control
which nodes and edges are visible.

### View Definition

```typescript
interface GraphView {
  id: string;
  name: string;
  description: string;
  providers?: string[];        // include only these providers' nodes
  nodeTypes?: string[];        // include only these node types
  edgeTypes?: string[];
  clustering?: 'provider' | 'type' | 'directory' | 'label' | 'custom';
  layout?: 'force' | 'hierarchical' | 'radial' | 'timeline';
}
```

### Built-in Views

| View | What It Shows | Layout |
|------|-------------|--------|
| **Full Graph** | Everything from all providers | force |
| **Code Structure** | files, directories | hierarchical |
| **Documentation** | authored content | force |
| **Work Items** | issues, PRs | force |
| **Git History** | commits, branches, tags | timeline |
| **Hot Spots** | projected: most-changed files | force |

### Custom Views in Config

```yaml
views:
  - id: backend
    name: "Backend Architecture"
    nodeTypes: [file, directory]
    filter:
      glob: "src/api/**"
    layout: hierarchical

  - id: recent-work
    name: "Recent Work"
    providers: [github, git]
    nodeTypes: [issue, pull_request, commit]
    layout: timeline
```

### UI

A view selector in the HUD lets the user switch between views.
Each view re-filters the graph from the store — no re-fetching needed.

## On-Demand Expansion

When a provider resolves at limited depth, nodes are marked `expandable`.
The UI shows an expansion indicator (e.g., "+47 commits").

### Expansion Flow

```
User clicks expandable node
        ↓
UI calls provider.expand(nodeId)
        ↓
Provider fetches more data (e.g., full commit history)
        ↓
New nodes/edges inserted into graph store
        ↓
UI re-renders with expanded graph
```

### Expandable Indicators

The `expandable` table tracks what can be expanded:

| node_id | provider | hint | estimated_nodes |
|---------|----------|------|-----------------|
| `file-src/App.tsx` | git | "47 more commits" | 47 |
| `pr-28` | github | "12 files changed" | 12 |

The UI renders these as badges or buttons on the node.

### Expansion in Reading View

When viewing an expandable node:
- Show the resolved content at current depth
- Show expansion hint: "This file has 47 more commits. [Load them]"
- On click: call `provider.expand()`, add to store, re-render

## External Providers (Future)

Plugin providers for arbitrary external data sources.

### Provider Plugin Format

A provider plugin is a JavaScript module:

```javascript
// my-provider.js
export default {
  id: 'orgchart',
  name: 'Organization Chart',
  nodeTypes: ['person', 'team'],
  requires: ['network'],
  resolution: {
    default: 'standard',
    presets: {
      standard: { name: 'Standard', limits: { maxPeople: 100 } },
    },
  },
  async resolve(ctx) {
    const data = await fetch('https://api.example.com/org');
    const people = await data.json();
    return {
      nodes: people.map(p => ({ id: `person-${p.id}`, type: 'person', ... })),
      edges: people.map(p => ({ from: `person-${p.managerId}`, to: `person-${p.id}`, type: 'manages' })),
      expandable: [],
    };
  },
};
```

### Configuration

```yaml
providers:
  external:
    - path: ./providers/orgchart.js
    - npm: @company/jira-provider
```

### Constraints

- External providers are on-demand only (no pre-resolution by default)
- They must return `ProviderResult` format
- They run after all built-in providers
