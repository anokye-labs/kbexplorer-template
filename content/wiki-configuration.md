---
id: "wiki-configuration"
title: "Configuration Guide"
emoji: "Options"
cluster: guide
derived: true
connections: []
---

All configurable aspects of kbexplorer.

## Theme Configuration

The [theme system](theme-system) offers dark (default), light, and sepia. Users switch via `t` [keyboard shortcut](keyboard-nav) or UI toggle. Persists in localStorage under `kbe-theme`.

## Cluster Configuration

Defined in `content/config.yaml`, clusters determine grouping in the [overview view](overview-view) and coloring in the [graph network](graph-network):

```yaml
clusters:
  engine:
    name: "Engine"
    color: "#4A9CC8"
    description: "Core graph computation"
```

The [parser](parser)'s `extractClusters()` uses these. Auto-generated clusters receive computed hues.

## Content Source Configuration

The [content pipeline](content-pipeline) supports two modes: **Authored** (markdown with frontmatter) and **Repo-aware** (live data from [GitHub API](github-api)). The [KB loader](kb-loader) routes between modes. See [Content Modes](wiki-content-modes).

## HUD Configuration

The [HUD](hud) dock position and layer toggle states persist in localStorage. Minimap adapts to dock orientation.

## Cache Configuration

The [cache system](cache-system) uses 5-minute TTL and version-stamped keys. Bump `CACHE_VERSION` when changing data shapes. The [design decisions](design-decisions) node covers rationale.
