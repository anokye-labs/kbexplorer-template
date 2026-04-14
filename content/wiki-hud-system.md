---
id: "wiki-hud-system"
title: "HUD System Guide"
emoji: "PanelLeft"
cluster: guide
derived: true
connections: []
---

How to use the [HUD](hud) (Heads-Up Display) effectively.

## Minimap

Bird's-eye view of the constellation. Current node highlighted. Click to jump. Uses [graph network](graph-network)'s `computeGraphPositions()`.

## Related Panel

Up to 12 connected nodes as [NodeVisual](node-visual) cards. Click to navigate. Ranking prioritizes strongly-typed edges over high-degree weak connections (#52).

## Layer Toggles

Four buttons show/hide node groups: Content ([authored provider](authored-provider)), File ([files provider](files-provider)), Work ([work provider](work-provider)), Concept. Added in #55.

## Cluster Collapse

Click cluster label to collapse all nodes into one summary node. The [node renderer](node-renderer) draws a stacked appearance. Click again to expand. From #57.

## Dock Positions

Drag to any screen edge. The [style system](style-system) adapts layout. Persists in localStorage. Added in PR #28 alongside depth controls.

## Keyboard

Press `t` to cycle [themes](theme-system), arrows to navigate nodes — handled by [keyboard navigation](keyboard-nav).
