# kbexplorer-template

Interactive Knowledge Base Explorer — turn any GitHub repository into a navigable knowledge graph.

[![Deploy to GitHub Pages](https://github.com/anokye-labs/kbexplorer-template/actions/workflows/github-pages.yml/badge.svg)](https://github.com/anokye-labs/kbexplorer-template/actions/workflows/github-pages.yml)

**Live demo:** [anokye-labs.github.io/kbexplorer](https://anokye-labs.github.io/kbexplorer/)

---

## What is kbexplorer?

**kbexplorer** is a React + TypeScript application by [Anokye Labs](https://github.com/anokye-labs) that presents knowledge as an interactive, explorable graph. Point it at any GitHub repository and it transforms issues, pull requests, source files, and documentation into an interconnected constellation — navigable through a card grid, a force-directed network, or deep-dive reading views.

The project draws inspiration from three systems: **Claws**, a structured knowledge-base browser designed for fast retrieval; **Mukaase**, a narrative-first reader that treats content as linked prose; and **Okoto walkthrough**, an interactive tutorial engine that guides learners through a topic graph step by step. kbexplorer synthesizes these ideas into a single tool — exploration, narrative reading, and guided walkthrough in one interface.

Everything runs client-side. Content is fetched at runtime from the GitHub API with no build step required for content changes. Deploy once, and the knowledge graph stays current with the repository it explores.

## Features

- **Card grid overview** — topics grouped by cluster with visual identity cards
- **Constellation graph** — force-directed network visualization powered by [vis-network](https://visjs.github.io/vis-network/docs/network/)
- **Reading view** — full markdown prose with rendered HTML content
- **Persistent HUD** — minimap, related-nodes panel, and reading tools visible across views
- **Theme switching** — dark, light, and sepia modes with customizable fonts
- **Keyboard navigation** — full keyboard support for view switching and node traversal
- **Responsive design** — adapts from desktop to mobile layouts
- **Runtime content** — fetches from GitHub API with localStorage caching (no rebuild needed)

## Content Modes

kbexplorer supports two content modes, configured by the presence of a `source.path` in `config.yaml`.

### Repo-aware (default)

When no content path is set, kbexplorer treats the target GitHub repository itself as the knowledge base. It fetches issues, pull requests, the README, and source files, then maps them into a graph. Issue labels become clusters; cross-references become edges.

For a live example, explore this project's own [issues](https://github.com/anokye-labs/kbexplorer/issues) — each one becomes a navigable node in the graph.

### Authored

When `source.path` points to a directory of markdown files (e.g., `content/`), kbexplorer parses each file's YAML frontmatter to build a hand-curated knowledge base. This mode gives full control over node metadata, hierarchy, and connections.

## Visual Identity System

kbexplorer provides four visual modes for presenting nodes. Each mode determines what asset type appears across seven surfaces in the UI.

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
| Overview cards | Card thumbnails in the grid view |
| Graph nodes | Node icons in the constellation view |
| Reading header | Hero image or sprite at the top of a reading view |
| HUD minimap | Miniature node representations in the minimap |
| HUD related | Thumbnails in the related-nodes panel |
| Loading screen | Visual shown during initial content fetch |
| Page favicon | Dynamic favicon reflecting the active node |

A `fallback` mode activates when the primary mode's asset is missing for a given node (e.g., a node without a `sprite` field falls back to `emoji`).

## Getting Started

### Prerequisites

- **Node.js 18+** and npm

### Install and run

```bash
git clone https://github.com/anokye-labs/kbexplorer-template.git
cd kbexplorer-template
npm install
npm run dev
```

The dev server starts at `http://localhost:5173`. By default, kbexplorer explores its own GitHub repository.

### Build for production

```bash
npm run build
```

Output is written to `dist/`. The build runs TypeScript type-checking (`tsc -b`) before bundling with Vite.

### Lint

```bash
npm run lint
```

## Configuration

kbexplorer loads a `config.yaml` from the target repository at runtime. Place it at the root of the content path (or repo root for repo-aware mode).

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

In authored mode, each markdown file in the content directory becomes a node. Use YAML frontmatter to define metadata:

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
| `id` | Yes | Unique node identifier |
| `title` | Yes | Display title |
| `emoji` | No | Unicode emoji for emoji/fallback mode |
| `cluster` | No | Cluster ID (must match a key in `config.yaml` clusters) |
| `image` | No | Hero image path (relative to repo root) |
| `sprite` | No | Sprite illustration path (relative to repo root) |
| `parent` | No | Parent node ID for hierarchical grouping |
| `connections` | No | Array of `{ to, description }` defining explicit edges |

### Clusters

Clusters group nodes by topic. Define them in `config.yaml` with a display name and color. Nodes reference clusters by key in their `cluster` frontmatter field.

### Connections

Connections create explicit edges between nodes. In repo-aware mode, connections are inferred from issue cross-references and PR links. In authored mode, declare them in frontmatter.

## Using in Another Repo

Install the CLI tool and run init:

```bash
npx @anokye-labs/kbexplorer init
```

This adds `.kbexplorer/` as a submodule, installs agents and skills to `.github/agents/` and `.github/skills/`, runs an interactive config wizard, and sets up npm scripts.

### CLI Commands

```bash
npx @anokye-labs/kbexplorer init        # Setup: submodule + agents + skills + config
npx @anokye-labs/kbexplorer generate    # Generate content from code analysis
npx @anokye-labs/kbexplorer dev         # Start dev server (local mode)
npx @anokye-labs/kbexplorer build       # Production build
npx @anokye-labs/kbexplorer manifest    # Regenerate repo manifest
npx @anokye-labs/kbexplorer update      # Pull latest template + refresh agents/skills
```

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

```
src/
├── api/          GitHub API client (Octokit) with localStorage caching
├── engine/       Graph computation and markdown/frontmatter parsing
├── components/   Shared UI: HUD, NodeVisual, LoadingScreen, ErrorScreen
├── views/        Route-level views: OverviewView, GraphView, ReadingView
├── hooks/        React hooks: useKnowledgeBase, useTheme, useKeyboardNav
├── styles/       CSS modules for each view and component
└── types/        TypeScript interfaces: KBNode, KBGraph, KBConfig
```

**Data flow:** `useKnowledgeBase` fetches content via `api/github.ts` → `engine/parser.ts` normalizes into `KBNode[]` → `engine/graph.ts` computes edges, clusters, and related nodes → views render the `KBGraph`.

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

## Phase 2 Roadmap

The next major addition is a **Copilot conversation module** — an embedded conversational interface that lets users ask questions about the knowledge graph and receive contextual answers grounded in the graph's content.

## License

[MIT](LICENSE)
