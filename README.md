# kbexplorer-template

Interactive Knowledge Base Explorer — turn any GitHub repository into a navigable knowledge graph.

[![Deploy to GitHub Pages](https://github.com/anokye-labs/kbexplorer-template/actions/workflows/github-pages.yml/badge.svg)](https://github.com/anokye-labs/kbexplorer-template/actions/workflows/github-pages.yml)

**Live demo:** [anokye-labs.github.io/kbexplorer-template](https://anokye-labs.github.io/kbexplorer-template/)

---

## What is kbexplorer?

**kbexplorer** is a React + TypeScript application by [Anokye Labs](https://github.com/anokye-labs) that presents knowledge as an interactive, explorable graph. Point it at any GitHub repository and it transforms issues, pull requests, source files, and documentation into an interconnected constellation — navigable through a [card grid](overview-view), a force-directed [constellation graph](graph-network), or deep-dive [reading views](reading-view).

The project draws inspiration from three systems: **Claws**, a structured knowledge-base browser designed for fast retrieval; **Mukaase**, a narrative-first reader that treats content as linked prose; and **Okoto walkthrough**, an interactive tutorial engine that guides learners through a topic graph step by step. kbexplorer synthesizes these ideas into a single tool — exploration, narrative reading, and guided walkthrough in one interface.

Everything runs client-side. Content is fetched at runtime from the [GitHub API](github-api) with no build step required for content changes. Deploy once, and the knowledge graph stays current with the repository it explores. For offline or CI workflows, [local mode](local-loader) uses a pre-built [manifest](manifest-generator) instead.

## Features

- **[Card grid overview](overview-view)** — topics grouped by cluster with [visual identity](visual-system) cards
- **[Constellation graph](graph-network)** — force-directed network visualization with [custom node rendering](node-renderer) and typed edges
- **[Reading view](reading-view)** — full markdown prose with inline links that navigate the graph
- **Persistent [HUD](hud)** — minimap, related-nodes panel, layer toggles, and reading tools visible across views
- **[Theme switching](theme-system)** — dark, light, and sepia modes with customizable fonts
- **[Keyboard navigation](keyboard-nav)** — full keyboard support for view switching and node traversal
- **Responsive design** — adapts from desktop to mobile via the [CSS style system](style-system)
- **Runtime content** — fetches from the [GitHub API client](github-api) with [localStorage caching](cache-system) (no rebuild needed)

## Content Modes

kbexplorer supports [two content modes](wiki-content-modes), configured by the presence of a `source.path` in `config.yaml`.

### Repo-aware (default)

When no content path is set, kbexplorer treats the target GitHub repository itself as the knowledge base. The [content pipeline](content-pipeline) fetches issues, pull requests, the README, and source files, then maps them into a graph. Issue labels become clusters; cross-references become [typed edges](spec-typed-edges).

For a live example, explore this project's own [issues](https://github.com/anokye-labs/kbexplorer/issues) — each one becomes a navigable node in the graph.

### Authored

When `source.path` points to a directory of markdown files (e.g., `content/`), kbexplorer parses each file's YAML frontmatter to build a hand-curated knowledge base. The [content pipeline](content-pipeline) extracts [inline links](spec-inline-link-extraction) from the markdown body to create graph edges automatically — frontmatter connections are supplementary.

## Visual Identity System

kbexplorer's [visual system](visual-system) provides four modes for presenting nodes. Each mode determines what asset type the [node renderer](node-renderer) draws across seven surfaces in the UI.

### Modes

| Mode | Assets | Best For |
|------|--------|----------|
| `sprites` | Character illustrations | Technical walkthroughs, branded docs |
| `heroes` | Full-bleed photography | Essays, narratives, editorial |
| `emoji` | Unicode emoji | Lightweight, text-focused |
| `none` | Text only | Minimal deployments |

### Surfaces

Visuals appear on these surfaces throughout the application:

| Surface | Description |
|---------|-------------|
| [Overview cards](overview-view) | Card thumbnails in the [card grid](overview-view) |
| [Graph nodes](graph-network) | Node icons in the [constellation](graph-network) view |
| [Reading header](reading-view) | Hero image or sprite at the top of a [reading view](reading-view) |
| [HUD](hud) minimap | Miniature node representations in the [HUD](hud) minimap |
| [HUD](hud) related | Thumbnails in the [related-nodes panel](hud) |
| [Loading screen](loading-error-screens) | Visual shown during initial content fetch |
| Page favicon | Dynamic favicon reflecting the active node |

A `fallback` mode activates when the primary mode's asset is missing for a given node (e.g., a node without a `sprite` field falls back to `emoji`).

## Getting Started

For a comprehensive guide, see [Getting Started](wiki-getting-started). For a deeper look at internals, see the [Architecture Deep Dive](wiki-deep-dive).

### Prerequisites

- **Node.js 18+** and npm

### Install and run

```bash
git clone https://github.com/anokye-labs/kbexplorer-template.git
cd kbexplorer-template
npm install
npm run dev
```

The [Vite](vite-config) dev server starts at `http://localhost:5173`. By default, kbexplorer explores its own GitHub repository.

### Build for production

The [build scripts](build-scripts) run TypeScript type-checking (`tsc -b`) before bundling with [Vite](vite-config):

```bash
npm run build
```

Output is written to `dist/`.

### Lint

```bash
npm run lint
```

## Configuration

kbexplorer loads a `config.yaml` from the target repository at runtime. See the [configuration reference](wiki-configuration) for full details. Place it at the root of the content path (or repo root for repo-aware mode).

```yaml
title: "My Knowledge Base"
subtitle: "An explorable guide"
author: "Your Name"
date: "2025"

source:
  owner: your-org
  repo: your-repo
  path: content          # omit for repo-aware mode
  branch: main

clusters:
  concept:
    name: Concepts
    color: "#4A9CC8"
  tutorial:
    name: Tutorials
    color: "#8CB050"
  reference:
    name: Reference
    color: "#E8A838"

visuals:
  mode: emoji            # sprites | heroes | emoji | none
  fallback: emoji
  hero:
    overlay: dark-gradient
    height: "300px"
    animation: reveal
  graph:
    nodeImages: true
    nodeSizeByConnections: true

theme:
  default: dark          # dark | light | sepia
  font:
    heading: "Instrument Serif"
    body: "General Sans"
    mono: "JetBrains Mono"

graph:
  physics: true
  layout: force-atlas-2  # force-atlas-2 | manual

features:
  hud: true
  minimap: true
  readingTools: true
  keyboardNav: true
  sparkAnimation: false

bluf:
  quote: "Knowledge is the path."
  duration: "5s"
```

## Content Authoring

In authored mode, each markdown file in the content directory becomes a node. The [content pipeline](content-pipeline) parses YAML frontmatter and extracts [inline links](spec-inline-link-extraction) from the body to create graph edges automatically. Use frontmatter to define metadata:

```markdown
---
id: intro-to-graphs
title: Introduction to Graphs
emoji: "🕸️"
cluster: concept
image: assets/graphs-hero.jpg    # heroes mode
sprite: assets/graphs-sprite.png # sprites mode
parent: fundamentals
connections:
  - to: graph-traversal
    description: "prerequisite for"
  - to: adjacency-matrix
    description: "introduces"
---

# Introduction to Graphs

A graph is a set of **nodes** connected by **edges**...
```

### Frontmatter fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique node identifier used in [inline links](spec-inline-link-extraction) |
| `title` | Yes | Display title shown in the [reading view](reading-view) and [HUD](hud) |
| `emoji` | No | Fluent icon name or Unicode emoji for the [visual system](visual-system) |
| `cluster` | No | Cluster ID (must match a key in `config.yaml` [clusters](wiki-configuration)) |
| `image` | No | Hero image path for the [visual system](visual-system) heroes mode |
| `sprite` | No | Sprite illustration path for sprites mode |
| `parent` | No | Parent node ID for hierarchical grouping |
| `connections` | No | Supplementary `{ to, description }` edges (prefer [inline links](spec-inline-link-extraction)) |

### Clusters

Clusters group nodes by topic. Define them in `config.yaml` with a display name and color. Nodes reference clusters by key in their `cluster` frontmatter field.

### Connections

Connections create edges between nodes. In repo-aware mode, the [content pipeline](content-pipeline) infers connections from issue cross-references and PR links as [typed edges](spec-typed-edges). In authored mode, [inline links](spec-inline-link-extraction) in the markdown body (`[text](target-id)`) are the primary way to create edges — the parser extracts them automatically. Frontmatter `connections:` are supplementary for relationships that can't be expressed inline.

## Using in Another Repo

Install the CLI tool and run [init](init-script):

```bash
npx @anokye-labs/kbexplorer init
```

This adds `.kbexplorer/` as a submodule, installs agents and skills to `.github/agents/` and `.github/skills/`, runs an interactive [config wizard](init-script), and sets up npm scripts.

### CLI Commands

```bash
npx @anokye-labs/kbexplorer init        # Setup: submodule + agents + skills + config
npx @anokye-labs/kbexplorer generate    # Generate content from code analysis
npx @anokye-labs/kbexplorer dev         # Start dev server (local mode)
npx @anokye-labs/kbexplorer build       # Production build
npx @anokye-labs/kbexplorer manifest    # Regenerate repo manifest
npx @anokye-labs/kbexplorer update      # Pull latest template + refresh agents/skills
```

The `manifest` command runs the [manifest generator](manifest-generator) to pre-build a snapshot of the repo's content, issues, and file tree for [local mode](local-loader). The `generate` command uses the [catalogue transformer](catalogue-transformer) to convert AI-generated analysis into authored content nodes.

Or install locally: `npm install -D @anokye-labs/kbexplorer`

### Updating

```bash
npx @anokye-labs/kbexplorer update
```

For more details, see the [CLI documentation](https://github.com/anokye-labs/kbexplorer-cli).

## Deployment

kbexplorer deploys to **Azure Static Web Apps** via GitHub Actions.

### Setup

1. Create an Azure Static Web App resource in the [Azure Portal](https://portal.azure.com)
2. Copy the deployment token from the Azure resource
3. Add it as a repository secret named `AZURE_STATIC_WEB_APPS_API_TOKEN`
4. Push to `main` — the workflow builds and deploys automatically

Pull requests get automatic staging environments. The `staticwebapp.config.json` in the repo root handles SPA routing, rewriting all paths to `index.html` (excluding static assets).

### Workflow

The GitHub Actions workflow (`.github/workflows/azure-static-web-apps.yml`) triggers on:

- **Push to main** — builds and deploys to production
- **Pull request** — builds and deploys a staging preview
- **PR closed** — cleans up the staging environment

## Architecture

The [application shell](app-shell) boots the UI and sets up routing. The [KB loader](kb-loader) hook fetches content — either from the [GitHub API client](github-api) at runtime or from a pre-built [manifest](manifest-generator) in [local mode](local-loader).

```
src/
├── api/          GitHub API client with localStorage caching
├── engine/       Graph engine, content pipeline, and parser
├── components/   HUD, NodeVisual, LoadingScreen, ErrorScreen
├── views/        OverviewView, GraphView, ReadingView
├── hooks/        useKnowledgeBase, useTheme, useKeyboardNav
├── styles/       CSS style system
└── types/        Core type definitions: KBNode, KBGraph, KBConfig
```

**Data flow:** The [KB loader](kb-loader) fetches content via the [GitHub API client](github-api) with [localStorage caching](cache-system) → the [content pipeline](content-pipeline) normalizes it into `KBNode[]` using the [type system](type-system) → the [graph engine](graph-engine) computes [typed edges](spec-typed-edges), clusters, and related nodes → the [overview grid](overview-view), [constellation graph](graph-network), and [reading view](reading-view) render the `KBGraph`.

**Graph intelligence:** The [graph engine](graph-engine) ranks connections by [edge weight](spec-typed-edges) — structural edges like `contains` rank higher than inferred `mentions`. The [HUD](hud) uses this to show the most relevant [related nodes](hud) for whatever you're reading. [Inline links](spec-inline-link-extraction) in authored content become first-class graph edges automatically.

**Rendering:** The [custom node renderer](node-renderer) draws 2,600+ Fluent UI icons on the HTML canvas. Each node's shape and color is determined by its cluster and the [visual system](visual-system). The [graph network factory](graph-network) handles physics simulation, neighborhood emphasis, and pan/zoom.

**Routing:** Hash-based routing via `react-router-dom` (`#/`, `#/graph`, `#/node/:id`). No server-side routing required.

**Key dependencies:**

| Package | Purpose |
|---------|---------|
| `react` / `react-dom` | UI framework (v19) |
| `react-router-dom` | Client-side routing |
| `vis-network` / `vis-data` | Graph visualization |
| `@octokit/rest` | GitHub API client |
| `gray-matter` | YAML frontmatter parsing |
| `marked` | Markdown → HTML rendering |
| `yaml` | Configuration file parsing |

## Roadmap

The [graph provider architecture](spec-providers-overview) is the next major evolution — replacing the current monolithic pipeline with pluggable providers for files, git, GitHub, and external services. Key specs:

- **[Node mapping](spec-node-mapping)** — how files become nodes, with configurable `nodemap.yaml`
- **[Graph store](spec-graph-store)** — SQLite-backed graph persistence with provider interface
- **[Views and projections](spec-views)** — filtered views, on-demand expansion, and external providers
- **[Multi-layer identity](spec-multi-layer-identity)** — same entity recognized across providers

The [link assessment](spec-link-assessment) tool already provides graph health analysis — orphan detection, broken references, coverage gaps.

## License

[MIT](LICENSE)
