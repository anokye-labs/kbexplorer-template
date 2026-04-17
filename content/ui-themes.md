---
title: Themes & Appearance
emoji: WeatherSunny
cluster: ui
connections:
  - to: theme-system
    type: references
    description: Theme implementation
  - to: style-system
    type: references
    description: Fluent UI styling
  - to: wiki-fluent
    type: references
    description: Fluent Design System
  - to: ui-constellation
    type: references
    description: Graph appearance changes with theme
---

kbexplorer supports three themes that affect every surface — the reading view, constellation graph, HUD controls, and all Fluent UI components.

## Dark theme

The default. Optimized for extended reading sessions and graph visualization — node colors pop against the dark background, and edge importance tiers are most visible here.

![Dark theme with sidebar graph](screenshots/02-sidebar-graph-dark.png)

## Light theme

A clean, high-contrast mode. The graph legend and cluster colors adapt automatically via [Fluent's theme tokens](wiki-fluent).

![Light theme](screenshots/03-sidebar-graph-light.png)

## Sepia theme

A warm, amber-tinted theme built with a custom `createLightTheme` brand ramp. Designed for comfortable long-form reading.

![Sepia theme](screenshots/04-sidebar-graph-sepia.png)

## Switching themes

Theme buttons are in the HUD toolbar — the moon (dark), sun (light), and book (sepia) icons. The selected theme persists across sessions via localStorage.

## How it works

Themes are applied via Fluent's `FluentProvider` context, which cascades [design tokens](style-system) to every component. The constellation graph reads `isDark` from the current theme to adjust node opacity, edge colors, and background contrast.
