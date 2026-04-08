---
id: "wiki-theming"
title: "Theme System"
emoji: "Book"
cluster: guide
parent: "wiki-deep-dive"
connections:
  - to: "theme-system"
    description: "architecture doc"
---



# Theme System

kbexplorer supports three themes via Fluent 2's FluentProvider.

## Themes

| Theme | Source | Description |
|-------|--------|-------------|
| **Dark** | `webDarkTheme` | Default. Standard Fluent dark palette. |
| **Light** | `webLightTheme` | Standard Fluent light palette. |
| **Sepia** | Custom `createLightTheme()` | Warm amber brand ramp (16 shades from `#1C1308` to `#FCF7F0`) with overrides for neutral background, card, and stroke tokens. |

## Architecture

A single `FluentProvider` wraps the entire app. The `useTheme` hook returns `[ThemeMode, FluentTheme, setMode]` — the theme object is passed to FluentProvider, and all components inherit colors, typography, and spacing automatically.

## Toggle

Three HUD buttons: moon (`WeatherMoonRegular`), sun (`WeatherSunnyRegular`), book (`BookRegular`). The `t` keyboard shortcut cycles through all three. Preference persists in localStorage as `kbe-theme`.

## Fallback

The `html` element has `background: #292929` as a fallback for scroll areas beyond FluentProvider's reach.
