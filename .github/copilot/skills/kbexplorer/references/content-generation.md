# Content Generation Reference

How kbexplorer generates knowledge base content from repository analysis, using
the kb-architect and kb-writer agents.

## kbexplorer Frontmatter Format

Every content file in `content/` uses this YAML frontmatter:

```yaml
---
id: unique-kebab-case-id        # Required. Unique node identifier.
title: "Human-Readable Title"   # Required. Display title.
emoji: "🏗️"                     # Optional. Unicode emoji for the node.
cluster: architecture           # Required. Cluster key (defined in config.yaml).
parent: parent-node-id          # Optional. Parent node for hierarchy.
connections:                    # Optional. Explicit edges to other nodes.
  - to: other-node-id
    description: "how they relate"
---

# Page content in Markdown

Rich content with source citations, Mermaid diagrams, and tables.
```

## Catalogue-to-Node Mapping

The kb-architect agent produces a JSON catalogue. The `transform-catalogue.js`
script converts it into kbexplorer content:

| Catalogue Field | kbexplorer Field | How It Maps |
|----------------|-----------------|-------------|
| Top-level sections | `cluster` | Each major section becomes a cluster in config.yaml |
| Node `id` | frontmatter `id` | Direct mapping (kebab-case) |
| Node `title` | frontmatter `title` | Direct mapping |
| Node `parent` | frontmatter `parent` | Catalogue hierarchy → parent field |
| Node `children` | child nodes' `parent` | Children reference the parent's id |
| Node `connections` | frontmatter `connections` | Code dependencies → edges in the graph |
| Section topic | frontmatter `emoji` | Inferred from topic keywords |
| Node `prompt` | Content generation hint | Passed to kb-writer as instructions |

## Emoji Mapping

Emojis are assigned based on topic keywords in the title and cluster:

| Topic Type | Emoji | Keywords |
|-----------|-------|----------|
| Architecture/Overview | 🏗️ | architecture, overview |
| Data/Database/State | 💾 | data, database, state |
| API/Network | 🔌 | api, network, http |
| UI/Components | 🎨 | ui, component, view, frontend, theme |
| Auth/Security | 🔐 | auth, security |
| Config/Build/Deploy | ⚙️ | config, build, deploy, infra |
| Testing | 🧪 | test, testing |
| Engine/Core Logic | ⚡ | engine, core, logic, performance |
| Documentation | 📖 | docs, guide, documentation |
| CLI/Tools | 🔧 | cli, tool, script |
| Graph/Network | 🕸️ | graph |
| Caching | 📦 | cache |
| Default | 📄 | (no match) |

## Connection Derivation Rules

Connections represent edges in the knowledge graph. They come from:

1. **Catalogue hierarchy**: Parent-child relationships create implicit edges
2. **Code dependencies**: If module A imports from module B, they're connected
3. **Cross-references**: When content references another node by id, add a connection
4. **Sibling relationships**: Nodes at the same level under the same parent may be connected if they interact

Connection descriptions should be specific:
- ✅ `"authenticates access to"`, `"renders via"`, `"feeds data to"`
- ❌ `"related to"`, `"see also"`, `"connected"`

## Using the Pipeline

### Full generation (`/kb:generate`)

```
1. kb-architect scans repo → JSON catalogue
2. transform-catalogue.js → config.yaml + skeleton .md files
3. kb-writer generates rich content for each skeleton
4. generate-manifest.js rebuilds the manifest
5. Dev server starts + playwright-cli validates
```

### Incremental updates

To add a single topic without regenerating everything:

1. Create a new `.md` file in `content/` with proper frontmatter
2. Use the kb-writer agent to generate rich content for that file
3. Run `npm run prebuild` to update the manifest

### Manual content

You can always hand-write content files. The frontmatter format is simple —
just ensure `id`, `title`, and `cluster` are set, and the cluster exists
in `config.yaml`.
