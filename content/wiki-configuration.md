---
id: "wiki-configuration"
title: "Configuration Reference"
emoji: "📖"
cluster: guide
parent: "wiki-getting-started"
connections:
  - to: "theme-system"
    description: "theme config"
  - to: "visual-system"
    description: "visual config"
  - to: "type-system"
    description: "KBConfig interface"
---



# Configuration Reference

kbexplorer loads `config.yaml` from the content path (or repo root) at runtime. All fields are optional — sensible defaults apply.

## Source

```yaml
source:
  owner: anokye-labs
  repo: kbexplorer
  path: content          # omit for repo-aware only
  branch: main
```

## Clusters

Define named groups with colors. Nodes reference clusters by key:

```yaml
clusters:
  engine:
    name: Engine
    color: "#4A9CC8"
  ui:
    name: Interface
    color: "#8CB050"
```

Clusters not defined in config are auto-generated from node data with colors from a built-in palette.

## Visuals

```yaml
visuals:
  mode: emoji            # sprites | heroes | emoji | none
  fallback: emoji
```

## Theme

```yaml
theme:
  default: dark          # dark | light | sepia
```

## Features

```yaml
features:
  hud: true
  minimap: true
  readingTools: true
  keyboardNav: true
```

## Default Config

The full default configuration is defined in `src/types/index.ts` as `DEFAULT_CONFIG`. It targets the kbexplorer repo itself with the `content/` path for blended mode.
