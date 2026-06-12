---
id: "wiki-theming"
title: "Theming Guide"
emoji: "Color"
cluster: guide
derived: true
connections: []
---

Three built-in visual themes ship with the app, and your host repo can add more.

## Available Themes

| Theme | How to switch | Best For |
|-------|---------------|----------|
| **Dark** | palette menu or `t` | Code reading, low light |
| **Light** | palette menu or `t` | Bright environments, presentations |
| **Sepia** | palette menu or `t` | Extended reading, reduced eye strain |

Named themes defined in `config.yaml` (see [External Theming](theming-overview))
join the same list. Switch between any of them from the **paint-palette menu**
in the HUD (it lists every available theme with the active one checked), or press
**`t`** to cycle through them.

## How Themes Propagate

The [theme system](theme-system) returns a Fluent `Theme` object that the [application shell](app-shell) passes to `<FluentProvider>`. Every Fluent component picks up correct colors automatically.

Custom components use Fluent tokens via the [style system](style-system). The [node renderer](node-renderer) reads `isDark` to adjust canvas rendering. The [graph network](graph-network) uses theme colors for edges and backgrounds.

## The Sepia Theme

Custom `createLightTheme()` with amber brand ramp, overriding 20+ tokens:

```typescript
colorNeutralBackground1: '#F5ECD7'  // warm paper
colorNeutralForeground1: '#2A2520'  // warm dark text
```

## Customizing

You no longer need to edit the `.kbexplorer` submodule to restyle the site.
Everything is driven from your host repo's `config.yaml` (plus optional companion
files). The fastest path: add a `theme.brand` seed to recolor the whole app, or
add entries under `theme.themes` to grow the palette menu (and the `t` cycle)
with your own variants.

See **[External Theming](theming-overview)** for the full picture:
[brand, tokens & named themes](theming-named-themes),
[branding assets](theming-branding),
[scoped per-cluster/per-page theming](theming-scoped), and the
[modular escape hatches](theming-escape-hatches) (external theme file, raw CSS,
custom JS module).

## Persistence

Stored in localStorage under `kbe-theme`. The [visual system](visual-system) and [overview view](overview-view) respect the theme automatically.
