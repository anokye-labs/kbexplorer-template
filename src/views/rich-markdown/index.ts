/**
 * Public API for the rich-Markdown rendering feature (Wave 0b — #427).
 *
 * Import this barrel to read a node's rich-Markdown payload, plan how a prose
 * fence renders, or register/resolve block renderers. The block-renderer
 * registry is the open seam — modeled on the viewer registry — that lets new
 * block kinds (`mermaid` live, `dot` / `ics` / `canvas` via pre-built SVG) be
 * added without editing any core type.
 *
 * @example
 * ```ts
 * import { getRichMarkdownDocument, planProseFence } from './views/rich-markdown';
 * const doc = getRichMarkdownDocument(node);
 * const output = planProseFence('dot', fenceSource, doc?.blocks); // → { type: 'svg', … }
 * ```
 */
export {
  type BlockRange,
  type RichMarkdownBlock,
  type RichMarkdownDocument,
  getRichMarkdownDocument,
  isRichMarkdownNode,
  normalizeBlockSource,
} from './types';

export {
  type BlockOutput,
  type BlockRenderContext,
  type BlockRenderer,
  registerBlockRenderer,
  hasBlockRenderer,
  getBlockRenderer,
  getRegisteredBlockKinds,
  resetBlockRendererRegistry,
  resolveBlockOutput,
  svgFallbackOutput,
} from './registry';

export {
  mermaidBlockRenderer,
  dotBlockRenderer,
  icsBlockRenderer,
  canvasBlockRenderer,
  registerBuiltinBlockRenderers,
  ensureBuiltinBlockRenderers,
} from './renderers';

export { findBlockForFence, planProseFence } from './plan';
export { svgToImageDataUri } from './svg';

export { FrontmatterFacts } from './FrontmatterFacts';
export { RichMarkdownDocumentView } from './RichMarkdownDocumentView';
