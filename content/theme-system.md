---
id: "theme-system"
title: "Theme System"
emoji: "Color"
cluster: ui
connections: []
---


# Theme System

kbexplorer supports three themes via Fluent 2's `FluentProvider`: **dark**, **light**, and **sepia**.

## Implementation

The `useTheme` hook (`src/hooks/useTheme.ts`) returns `[ThemeMode, FluentTheme, setMode]`. The [app shell](app-shell) calls `useTheme` and passes the active Fluent theme to a single `FluentProvider` at the root — all components, including the [visual system](visual-system), inherit colors, typography, and spacing automatically.

## Themes

- **Dark** — `webDarkTheme` from @fluentui/react-components
- **Light** — `webLightTheme` from @fluentui/react-components
- **Sepia** — custom theme built with `createLightTheme()` using a 16-shade warm amber `BrandVariants` ramp (from `#1C1308` to `#FCF7F0`), with overrides for neutral background, card, and stroke tokens

The active theme also determines opaque background fills in the [node renderer](node-renderer), preventing edge bleed-through on the graph canvas.

## Toggle

The [HUD — Heads-Up Display](hud) tools strip has three buttons: moon (WeatherMoonRegular), sun (WeatherSunnyRegular), and book (BookRegular) icons. The `t` [keyboard shortcut](keyboard-nav) cycles through all three. Preference persists in localStorage as `kbe-theme`.

## Fallback Background

The `html` element has `background: #292929` as a fallback for scroll areas beyond the FluentProvider's reach (e.g., overscroll on mobile).
