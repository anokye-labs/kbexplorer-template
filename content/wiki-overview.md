---
id: "wiki-overview"
title: "What is kbexplorer?"
emoji: "Book"
cluster: guide
parent: "wiki-getting-started"
connections:
  - to: "overview"
    description: "architecture overview"
---



# What is kbexplorer?

kbexplorer turns any GitHub repository into a navigable knowledge graph. Point it at a repo and it fetches issues, the README, and the file tree at runtime — no build step required — then renders them as an interconnected constellation you can explore through reading views and a live force-directed graph.

## Three Inspirations

The project synthesizes patterns from three knowledge explorer prototypes built by Anokye Labs:

**Claws** was a structured KB browser optimized for fast retrieval — hierarchical cards, deep-dive panels, keyboard-driven navigation. kbexplorer inherits its card-based node browsing.

**Mukaase** was a narrative reader that treated content as linked prose with a persistent bottom control bar. kbexplorer's HUD — the dockable toolbar with navigation, theme controls, and related nodes — is a direct descendant.

**Okoto** was an interactive architecture walkthrough with a sidebar constellation graph, parent/section node hierarchy, and node emphasis (current + neighbors bright, rest faded). kbexplorer's sidebar layout, live graph, and emphasis system are modeled on Okoto.

## Core Experience

1. **Land on README** — the homepage is always the README, the natural entry point to any repo
2. **Read and explore** — prose content with child nodes linked as cards below
3. **Navigate the constellation** — the sidebar graph shows your position in the knowledge network, click nodes to jump
4. **See connections** — every node shows its related nodes in the HUD's connections panel
