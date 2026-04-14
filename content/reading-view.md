---
id: "reading-view"
title: "Reading View"
emoji: "BookOpen"
cluster: ui
derived: true
connections: []
---

The reading view (`src/views/ReadingView.tsx`) is the immersive content reader that displays a single node's full content with navigation controls. Introduced in [PR #7](https://github.com/anokye-labs/kbexplorer-template/pull/7) and refreshed with Fluent 2 in [PR #22](https://github.com/anokye-labs/kbexplorer-template/pull/22), this is where users spend most of their time — reading, following connections, and building understanding.

## Layout

The view has three sections:

1. **Hero header** — node emoji, title, cluster badge, and breadcrumb navigation
2. **Prose body** — rendered markdown with theme-appropriate typography
3. **Connections panel** — [NodeVisual](node-visual) cards for related nodes

The prose uses a `.kb-prose` CSS class with Fluent token values. A font sizer control (fixed in [PR #19](https://github.com/anokye-labs/kbexplorer-template/pull/19)) lets users adjust text size via a CSS variable.

## Content Rendering

Node content arrives as pre-rendered HTML from the [parser](parser). The view injects it via `dangerouslySetInnerHTML` and applies theme styles. Inline links to other nodes (`[text](node-id)`) are clickable and navigate within the app. File path references became clickable in [#51](https://github.com/anokye-labs/kbexplorer-template/issues/51).

## Keyboard Navigation

Arrow keys (`←`/`→`) navigate to the previous/next node in sequence, handled by the [keyboard nav](keyboard-nav) hook ([#16](https://github.com/anokye-labs/kbexplorer-template/issues/16)).

## Sidebar Graph

An embedded constellation graph shows the active node's neighborhood in the [HUD](hud) sidebar. The graph uses emphasis mode from the [graph network](graph-network) to highlight the current node. Panning was enabled and zoom fixed in commit `8d79295`.

```typescript
<ReadingView node={currentNode} graph={graph} relatedNodes={graph.related[currentNode.id]} />
```

## Content Modes

The view works identically for both content modes — authored markdown and repo-aware content from the [GitHub API](github-api). The [type system](type-system) abstracts the difference — `KBNode.content` is always rendered HTML.
