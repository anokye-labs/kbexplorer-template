---
title: Node Types & Sources
emoji: DocumentBulletList
cluster: ui
connections:
  - to: github-api
    type: references
    description: GitHub issues and PRs
  - to: content-pipeline
    type: references
    description: Authored content
  - to: wiki-knowledge-graph
    type: references
    description: External Wikipedia nodes
  - to: icon-gallery
    type: references
    description: Icon gallery display mode
---

Every node in kbexplorer comes from a **provider** — a system of record that feeds data into the knowledge graph. The source badge next to each node's title tells you exactly what kind of thing you're looking at and where it came from.

## GitHub Issues

Issues show their state (🟢 open / 🟣 closed), labels, assignees, creation date, and a "View on GitHub ↗" link that opens the original issue in a new tab. Cross-references to other issues navigate within the graph.

![GitHub issue node with metadata](screenshots/10-issue-node.png)

## Pull Requests

PRs display the same rich metadata — state, labels, dates, and an external link. References to issues in the PR body become graph connections.

![Pull request node](screenshots/11-pr-node.png)

## Authored Content

Documentation nodes sourced from markdown files in the `content/` directory. These show the source filename in the badge and typically have the richest inline-linked prose.

![Authored content node](screenshots/13-content-node.png)

## External References

Wikipedia articles and other external sources show the provider name. Each includes an excerpt and a link to the original source.

![Wikipedia reference node](screenshots/12-wiki-node.png)

## Icon Gallery

A special [display mode](icon-gallery) that renders the Fluent icon library as a searchable, tiled grid — 2,647 icon families browseable within the graph.

![Icon gallery with search](screenshots/14-icon-gallery.png)
