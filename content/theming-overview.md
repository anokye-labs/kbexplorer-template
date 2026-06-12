---
id: "theming-overview"
title: "External Theming"
emoji: "PaintBrush"
cluster: guide
connections: [theming-named-themes, theming-branding, theming-scoped, theming-escape-hatches, wiki-theming, wiki-configuration]
---

You can restyle this site **entirely from your host repo's `config.yaml`** (and a
few optional companion files) — no edits to the `.kbexplorer` submodule required.

## What you can customize

| Layer | Where | What it changes |
|-------|-------|-----------------|
| **Initial mode + fonts** | `theme.default`, `theme.font.*` | Which theme loads first; heading/body/mono fonts |
| **Brand & tokens** | `theme.brand`, `theme.tokens` | The global accent ramp and any Fluent design token |
| **Named themes** | `theme.themes.*` | Extra selectable themes added to the `t` cycle |
| **Branding assets** | `branding.logo`, `branding.favicon` | The hero/HUD logo and the browser tab icon |
| **Scoped accents** | `clusters.*.tokens`, page frontmatter | Per-cluster and per-page color deltas |
| **Escape hatches** | `theme.themesFile`, `branding.css`, `theme.moduleUrl` | External theme file, raw CSS, or a custom JS theme module |

## The layering model

Themes compose from least to most specific, and the most specific value wins:

```
built-in (dark / light / sepia)
  → config named theme (theme.themes.<name>)
    → external theme file (theme.themesFile)
      → custom JS module (theme.moduleUrl)
```

Within a resolved theme, explicit `tokens` always win over a generated `brand`
ramp. On top of the active theme, **cluster** deltas scope to a cluster's
surfaces and **page** deltas (frontmatter) scope to a single page — page wins
over cluster for any overlapping token. Raw CSS (`branding.css`) is injected
last and can override anything the token system can't reach.

## Start simple, grow later

Everything here is **additive and optional**. A site with no `theme` block
behaves exactly as before (dark / light / sepia only). Add one field at a time:

1. Set `theme.default` and maybe `theme.font.*`.
2. Add a `theme.brand` seed to recolor the whole app.
3. Add a couple of `theme.themes` and press `t` to cycle them.
4. Reach for an [escape hatch](theming-escape-hatches) only when the structured
   options can't express what you need.

See the [named themes guide](theming-named-themes) to get started, or the
[configuration reference](wiki-configuration) for the full schema. This replaces
the older submodule-editing workflow described in the [theming guide](wiki-theming).
