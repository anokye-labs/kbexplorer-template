---
id: "wiki-getting-started"
title: "Getting Started"
emoji: "Book"
cluster: guide
connections: []
---



# Getting Started

This guide walks you through setting up kbexplorer, understanding its [content modes](wiki-content-modes), and [configuring](wiki-configuration) it for your repository. Start with [What is kbexplorer?](wiki-overview) for the conceptual foundation, or jump to [Installation & Development](wiki-setup) to get running immediately. For a bird's-eye view of the codebase, see the [architecture overview](overview).

## Quick Start

```bash
git clone https://github.com/anokye-labs/kbexplorer.git
cd kbexplorer
npm install
npm run dev
```

Open `http://localhost:5173` — by default it explores its own repository, showing issues, README, and file structure as an interactive knowledge graph.

## What You'll See

- **README as homepage** — the landing page renders the repo's README with a sidebar constellation showing your position in the graph
- **Sidebar HUD** — dock it left or right for the full Okoto-style experience: live graph up top, connections below, reading tools at the bottom
- **Three themes** — dark, light, and sepia, toggled from the HUD or with the `t` key
- **File tree** — directories and source files are nodes in the graph, connected to their parent folders

## Next Steps

Once you're oriented, continue to the [architecture deep dive](wiki-deep-dive) for a detailed walkthrough of kbexplorer's five major subsystems.
