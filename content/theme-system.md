---
id: theme-system
title: "Theme System"
emoji: "Lightbulb"
cluster: ui
connections:
  - to: visual-system
    description: "colors"
  - to: hud
    description: "toggled from"
  - to: node-renderer
    description: "affects rendering"
---

# Theme System

kbexplorer supports three themes via Fluent 2's `FluentProvider`: **dark**, **light**, and **sepia**.

## Implementation

The `useTheme` hook (`src/hooks/useTheme.ts`) returns `[ThemeMode, FluentTheme, setMode]`. A single `FluentProvider` instance at the app root receives the active theme — all components inherit colors, typography, and spacing automatically.

## Themes

- **Dark** — `webDarkTheme` from @fluentui/react-components
- **Light** — `webLightTheme` from @fluentui/react-components
- **Sepia** — custom theme built with `createLightTheme()` using a 16-shade warm amber `BrandVariants` ramp (from `#1C1308` to `#FCF7F0`), with overrides for neutral background, card, and stroke tokens

## Toggle

The HUD tools strip has three buttons: moon (WeatherMoonRegular), sun (WeatherSunnyRegular), and book (BookRegular) icons. The `t` keyboard shortcut cycles through all three. Preference persists in localStorage as `kbe-theme`.

## Fallback Background

The `html` element has `background: #292929` as a fallback for scroll areas beyond the FluentProvider's reach (e.g., overscroll on mobile).
