---
id: "app-shell"
title: "App Shell"
emoji: "WindowNew"
cluster: ui
derived: true
connections: []
---

The application shell (`src/App.tsx`) is the top-level React component that orchestrates layout, routing, and global state. It wraps everything in a Fluent `FluentProvider` for theming and renders three major regions: the sidebar [HUD](hud), the main content area (which switches between views), and global overlays like [loading/error states](loading-error-screens). It was scaffolded in [PR #2](https://github.com/anokye-labs/kbexplorer-template/pull/2).

## Routing

The app uses hash-based routing (`#/node/{id}`, `#/graph`, `#/overview`) to support Azure Static Web Apps SPA fallback without server configuration. Three views are mounted:

- **[Overview View](overview-view)** — card grid landing page, the default route
- **[Reading View](reading-view)** — immersive content reader for individual nodes
- **Graph View** — full constellation via [graph network](graph-network)

The initial route was changed from `readme` to `overview` in commit `5c37867`.

```typescript
<FluentProvider theme={fluentTheme}>
  <div className="kb-app">
    <HUD graph={graph} ... />
    <main>
      {route === 'overview' && <OverviewView ... />}
      {route === 'reading' && <ReadingView ... />}
      {route === 'graph' && <GraphView ... />}
    </main>
  </div>
</FluentProvider>
```

## State Management

The shell manages three pieces of global state via hooks:

1. **Knowledge base** — loaded via the [KB loader hook](kb-loader), which returns `{ status, graph, config }`
2. **Theme** — managed by the [theme system](theme-system)'s `useTheme()`, returning mode + Fluent theme object
3. **Keyboard navigation** — the [keyboard nav](keyboard-nav) hook listens for global shortcuts (`t` for theme, arrows for node navigation)

## Theme Integration

The `FluentProvider` receives the current theme from `useTheme()`. Theme changes propagate through all Fluent components and CSS token values instantly. The [theme system](theme-system) supports dark, light, and sepia — the sepia theme uses a custom `createLightTheme()` with an amber brand ramp. The Fluent 2 installation ([PR #20](https://github.com/anokye-labs/kbexplorer-template/pull/20)) made this propagation automatic.
