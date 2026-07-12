import type { ViewerComponent, LazyViewer } from './contract.js';
import type { BlockRenderer } from './blocks.js';

/**
 * The shape a provider's **render half** (its `./views` entry) default-exports.
 * A render-capable host dynamic-imports the specifier declared on the provider's
 * data module (`ProviderModule.views` in `@anokye-labs/kbexplorer-core`) and
 * mounts the contributions it finds here.
 *
 * Both fields are optional and additive — a provider may ship only viewers, only
 * block renderers, both, or (by omitting the `./views` entry entirely) neither.
 *
 * **Registry semantics (part of the contract).** When the host merges these into
 * its registries:
 *   - **Keys are case-insensitive.** A viewer registered for `'Person'` resolves
 *     for `'person'` / `'PERSON'`; a block renderer for `'Mermaid'` resolves for
 *     `'mermaid'`. Whitespace-only keys are rejected.
 *   - **Last registration wins.** Registering the same key twice replaces the
 *     prior entry, so a downstream provider (or the host) can override a built-in.
 *
 * @example
 * ```ts
 * // provider ./views entry
 * import type { ProviderViews } from '@anokye-labs/kbexplorer-view-kit';
 * import { createElement } from 'react';
 *
 * const views: ProviderViews = {
 *   viewers: {
 *     quote: ({ node }) => createElement('blockquote', null, node.title),
 *   },
 * };
 * export default views;
 * ```
 */
export interface ProviderViews {
  /**
   * Node/entity viewers keyed by `entityType` / JSON-LD `@type` / lens `viewer`
   * key. Each value is an eager {@link ViewerComponent} or a {@link LazyViewer}
   * loader the host code-splits.
   */
  viewers?: Record<string, ViewerComponent | LazyViewer>;
  /** Structured-block renderers keyed by block `kind`. */
  blockRenderers?: Record<string, BlockRenderer>;
}
