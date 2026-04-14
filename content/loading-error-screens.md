---
id: "loading-error-screens"
title: "Loading & Error Screens"
emoji: "Warning"
cluster: ui
derived: true
connections: []
---

The loading and error screens (`src/components/LoadingScreen.tsx`) provide feedback during the [KB loader](kb-loader)'s async startup phase. These are the first things users see when opening kbexplorer, so they set the visual tone for the entire experience.

## Loading State

While the [KB loader hook](kb-loader) fetches data from the [GitHub API](github-api) or loads the local manifest, the loading screen shows a Fluent `Spinner` component with a `Body1` status message. The Fluent 2 refresh ([PR #21](https://github.com/anokye-labs/kbexplorer-template/pull/21)) replaced the original custom spinner with the standard Fluent component.

## Error State

If loading fails — typically due to GitHub API rate limiting (60 req/hour for unauthenticated requests) or missing `GH_TOKEN` in CI — the error screen displays the error message with recovery guidance. Common causes include rate limiting, empty manifests (fix: `npm run prebuild`), and missing tokens (fixed in [PR #74](https://github.com/anokye-labs/kbexplorer-template/pull/74), [PR #75](https://github.com/anokye-labs/kbexplorer-template/pull/75)).

## Integration

The [application shell](app-shell) conditionally renders these screens based on the `LoadingState` discriminated union:

```typescript
type LoadingState =
  | { status: 'loading' }
  | { status: 'ready'; graph: KBGraph; config: KBConfig }
  | { status: 'error'; error: string };
```

The screens use Fluent tokens from the [visual system](visual-system) and adapt to the active theme automatically.
