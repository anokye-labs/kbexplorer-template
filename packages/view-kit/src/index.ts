/**
 * `@anokye-labs/kbexplorer-view-kit`
 *
 * The **UX-stack (React + Fluent) render contract** for kbexplorer. This is the
 * one place a provider's **render half** — the `./views` entry it ships — types
 * against, and the one place the host template's viewers / block renderers get
 * their contract types from. Exactly one definition, published, versioning in
 * lockstep with the surfaces that consume it.
 *
 * Where this sits in the dependency chain:
 *   - `@anokye-labs/kbexplorer-core` — pure, dependency-free **data** contract
 *     (KBNode / NodeLens / CalendarModel, and `ProviderModule.views`, the
 *     *specifier* for a render entry). Core deliberately does NOT define the
 *     render module shape.
 *   - **this package** — the render contract that shape (`ProviderViews`) and its
 *     parts (`ViewerProps`, `ViewerComponent`, `LazyViewer`, `BlockRenderer`,
 *     `BlockOutput`, …) live in, plus `VIEW_API_VERSION`.
 *
 * React is a **peer dependency** (React 18/19). Fluent design tokens are consumed
 * as CSS custom properties only — there is no `@fluentui/react-components` runtime
 * dependency in this package.
 */

export type { ViewerProps, ViewerComponent, LazyViewer } from './contract.js';

export type {
  BlockRange,
  RichMarkdownBlock,
  BlockOutput,
  BlockRenderContext,
  BlockRenderer,
} from './blocks.js';

export type { ProviderViews } from './provider-views.js';

export {
  VIEW_API_VERSION,
  checkViewCompatibility,
  type ViewCompatibility,
} from './version.js';

export { EntityHeader, Row, ScalarList, Pill } from './primitives.js';
