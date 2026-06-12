---
id: "theming-named-themes"
title: "Brand, Tokens & Named Themes"
emoji: "Color"
cluster: guide
connections: [theming-overview, theming-scoped, keyboard-nav, theme-system, wiki-configuration]
---

The `theme` block in `config.yaml` drives global color. Every field is optional.

## Default mode and fonts

```yaml
theme:
  default: dark        # which mode loads first: dark | light | sepia | a named theme
  font:
    heading: "'Segoe UI Variable', system-ui, sans-serif"
    body:    "'Segoe UI Variable', system-ui, sans-serif"
    mono:    "'Cascadia Code', Consolas, monospace"
```

Fonts are piped into `--kbe-font-heading`, `--kbe-font-body` and
`--kbe-font-mono` CSS variables, so every surface picks them up.

## Global brand

A single seed hex is expanded into a full 16-stop Fluent brand ramp and recolors
the entire app (primary buttons, active HUD indicators, links, focus rings):

```yaml
theme:
  brand: "#E81CA9"     # one seed → full ramp
```

You can also supply the ramp explicitly — an object keyed by stop `"10".."160"` —
when you want pixel-exact control over each step.

## Global token overrides

`theme.tokens` sets any Fluent design token on top of the active base theme.
Explicit tokens always win over the generated brand ramp:

```yaml
theme:
  tokens:
    colorNeutralBackground1: "#101418"
    borderRadiusMedium: "8px"
```

## Named themes

Add selectable variants under `theme.themes`. Each derives from a `base`
(`dark` or `light`), with its own optional `brand` and `tokens`:

```yaml
theme:
  themes:
    ocean:
      base: dark
      brand: "#1B6CA8"
    rose:
      base: light
      brand: "#C2185B"
      tokens:
        colorNeutralBackground1: "#FFF5F8"
```

## Choosing a theme

There are two ways to switch:

- **Palette menu** — the paint-palette button in the HUD opens a menu listing
  *every* available theme (built-ins plus your named, external-file, and module
  themes) with the active one checked. Click one to apply it.
- **Keyboard** — press **`t`** to cycle. The order is the built-ins first
  (dark → light → sepia), then your named themes in declaration order, then wrap.

Either way the active choice is saved to `localStorage` under `kbe-theme`; if a
saved theme is later removed from config, the app falls back to `theme.default`.
See [keyboard nav](keyboard-nav) for all shortcuts and the
[theme system](theme-system) for how a resolved Fluent `Theme` flows to
`<FluentProvider>`.

For per-cluster and per-page accents, see [scoped theming](theming-scoped).
