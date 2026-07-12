import type { ReactNode } from 'react';
import type { KBNode } from '@anokye-labs/kbexplorer-core';

/**
 * Props handed to every viewer. A viewer renders a single typed {@link KBNode}
 * — the same pure-data node contract exported by `@anokye-labs/kbexplorer-core`,
 * so a provider's render half and its data half agree on exactly one node shape.
 *
 * The object is intentionally minimal (just the node) so third-party lenses stay
 * decoupled from host internals; anything a viewer needs about a node it reads
 * from `node.data` / `node.jsonld` / `node.entityType`.
 */
export interface ViewerProps {
  /** The node to render. */
  node: KBNode;
}

/**
 * A **viewer** — a React function component that renders a typed node. Viewers
 * are registered in the host's viewer registry against an `entityType` (or
 * JSON-LD `@type`, or a {@link KBNode.lenses} `viewer` key) and resolved from it,
 * with the host's generic structured fallback for unknown types.
 *
 * This is a plain `(props) => ReactNode` function so a **no-build provider** can
 * author one with `React.createElement` (no JSX/precompile step); a JSX provider
 * precompiles only its `./views` entry.
 */
export type ViewerComponent = (props: ViewerProps) => ReactNode;

/**
 * A **lazily-loaded viewer** — a zero-argument loader that resolves to a module
 * namespace whose `default` export is the viewer. This matches the
 * `React.lazy(() => import('./MyView'))` calling convention, so a provider can
 * ship a heavy viewer behind a dynamic `import()` and the host can code-split it:
 *
 * ```ts
 * const CalendarView: LazyViewer = () => import('./CalendarView');
 * ```
 *
 * A registry accepts either an eager {@link ViewerComponent} or a `LazyViewer`;
 * the host is responsible for turning the loader into a mounted component (e.g.
 * via `React.lazy`).
 */
export type LazyViewer = () => Promise<{ default: ViewerComponent }>;
