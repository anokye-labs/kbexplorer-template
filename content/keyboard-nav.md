---
id: "keyboard-nav"
title: "Keyboard Navigation"
emoji: "Keyboard"
cluster: ui
derived: true
connections: []
---

The keyboard navigation hook (`src/hooks/useKeyboardNav.ts`) adds global keyboard shortcuts to kbexplorer, making the entire knowledge graph navigable without a mouse. It was implemented as part of [#16](https://github.com/anokye-labs/kbexplorer-template/issues/16) and shipped in [PR #8](https://github.com/anokye-labs/kbexplorer-template/pull/8) alongside the [theme system](theme-system) and [HUD](hud).

## Active Shortcuts

| Key | Action | Context |
|-----|--------|---------|
| `t` | Cycle theme (dark → light → sepia) | Global |
| `←` | Navigate to previous node | Reading view |
| `→` | Navigate to next node | Reading view |

## Implementation

The hook attaches a `keydown` listener to `window` and guards against input fields — shortcuts are suppressed when the user is typing in an `INPUT`, `TEXTAREA`, `SELECT`, or `contentEditable` element.

```typescript
export function useKeyboardNav(
  graph: KBGraph | null,
  setTheme: (t: Theme) => void
): void {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      // Handle 't' for theme cycling, arrows for node navigation
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [graph, setTheme]);
}
```

## Node Sequence Navigation

Arrow keys navigate through the graph's node array in order. The hook reads the current node ID from `window.location.hash`, finds its index in `graph.nodes`, and navigates to the adjacent node. Navigation wraps around — pressing `→` on the last node goes to the first.

## Theme Cycling

The `t` key reads the current theme from localStorage (via `kbe-theme`) and advances to the next mode using `nextTheme()` from the [theme system](theme-system). The responsive layout work ([PR #18](https://github.com/anokye-labs/kbexplorer-template/pull/18)) ensured all views handle theme changes gracefully.

## Integration

The [application shell](app-shell) calls this hook with the loaded graph and the theme setter. The hook has no UI — it is purely behavioral.
