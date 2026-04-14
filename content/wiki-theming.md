---
id: "wiki-theming"
title: "Theming Guide"
emoji: "Color"
cluster: guide
derived: true
connections: []
---

Three visual themes affect every surface in the application.

## Available Themes

| Theme | Shortcut | Best For |
|-------|----------|----------|
| **Dark** | `t` to cycle | Code reading, low light |
| **Light** | `t` to cycle | Bright environments, presentations |
| **Sepia** | `t` to cycle | Extended reading, reduced eye strain |

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

To add a theme: define a `BrandVariants` ramp in the [theme system](theme-system), create via `createLightTheme()`, override tokens, add to `MODES` and `THEME_MAP`, update [keyboard nav](keyboard-nav) cycle.

## Persistence

Stored in localStorage under `kbe-theme`. The [visual system](visual-system) and [overview view](overview-view) respect the theme automatically.
