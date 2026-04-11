---
id: "visual-system"
title: "Visual Identity System"
emoji: "PaintBrush"
cluster: visual
connections: []
---


# Visual Identity System

The visual system (`src/components/NodeVisual.tsx`) renders node icons across all UI surfaces — [reading view](reading-view) headers, connection cards, [HUD](hud) thumbnails, the [overview view](overview-view), and child node lists. It imports `resolveImageUrl` from the [GitHub API client](github-api) for repository-relative image paths and applies CSS classes from the [style system](style-system). The [node renderer](node-renderer) consumes these visuals for canvas-level graph drawing.

## Cluster-Colored Icons

Every Fluent icon renders in its cluster color via the `clusterColor` prop, with colour coordination from the [theme system](theme-system). This matches the colored enclosures in the constellation graph — a feature icon is the same blue whether you see it in the sidebar, the reading view header, or as a graph node.

## Icon Map

`FLUENT_ICONS` maps icon name strings to React components from @fluentui/react-icons:

| Icon Name | Component | Used For |
|-----------|-----------|----------|
| Sparkle | SparkleRegular | Features |
| Wrench | WrenchRegular | Tasks |
| Bug | BugRegular | Bugs |
| Flag | FlagRegular | Epics |
| Document | DocumentRegular | Files, docs |
| Folder | FolderRegular | Directories |
| Lightbulb | LightbulbRegular | Enhancements |
| Pin | PinRegular | Default |
| Merge | MergeRegular | Pull requests |
| BranchFork | BranchForkRegular | Commits |

## Surface Sizes

Each surface has a defined icon size — 80px for reading headers, 48px for cards, 44px for HUD thumbnails. The system auto-falls back to a letter-avatar when no matching icon exists.
