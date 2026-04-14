---
id: "theme-system"
title: "Theme System"
emoji: "DarkTheme"
cluster: visual
derived: true
connections: []
---

The theme system (`src/hooks/useTheme.ts`) provides three visual modes — dark, light, and sepia — that propagate through every surface in kbexplorer via Fluent UI's `FluentProvider` and CSS token system. Theme choice persists in localStorage and can be cycled with the `t` [keyboard shortcut](keyboard-nav).

## Three Themes

| Theme | Base | Character |
|-------|------|-----------|
| **Dark** | `webDarkTheme` | Default. High contrast for code and graphs |
| **Light** | `webLightTheme` | Standard Fluent light palette |
| **Sepia** | Custom `createLightTheme` | Warm amber paper for long reading sessions |

The sepia theme uses a custom `BrandVariants` ramp with 16 amber tones (#1C1308 to #FCF7F0) and overrides 20+ Fluent tokens for paper-like warmth — `colorNeutralBackground1: '#F5ECD7'`, `colorNeutralForeground1: '#2A2520'`. It was designed in [#13](https://github.com/anokye-labs/kbexplorer-template/issues/13) and shipped in [PR #8](https://github.com/anokye-labs/kbexplorer-template/pull/8).

## Hook API

```typescript
function useTheme(): [ThemeMode, FluentTheme, (t: ThemeMode) => void]
// Returns: [currentMode, fluentThemeObject, setMode]
```

The [application shell](app-shell) calls `useTheme()` and passes the Fluent theme to `<FluentProvider>`. All Fluent components and `makeStyles` rules automatically pick up the correct token values.

## Persistence

Theme choice is stored in localStorage under `kbe-theme`. The `readStored()` helper reads and validates on mount, defaulting to `dark`. This is one of the `kbe-*` keys mentioned in the AGENTS.md cache versioning rules.

## Integration

The theme affects the [node renderer](node-renderer) (icon fill/stroke), the [style system](style-system) (CSS variables), the [visual system](visual-system) (all seven surfaces), and the [graph network](graph-network) (edge/background colors). The Fluent 2 installation ([PR #20](https://github.com/anokye-labs/kbexplorer-template/pull/20)) made theme propagation automatic via `FluentProvider`.
