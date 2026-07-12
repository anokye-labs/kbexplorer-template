/**
 * The **block-render contract** — the render half of rich-Markdown / structured
 * blocks. A provider's `./views` entry ships `blockRenderers` typed against these
 * declarations; the host's block-renderer registry resolves a block `kind` to a
 * renderer and turns the returned {@link BlockOutput} decision into pixels.
 *
 * Renderers return a **pure decision** (no DOM/React), so the registry stays
 * node-testable; the React/DOM layer turns the decision into an element (live
 * Mermaid SVG, an inline pre-built SVG, a delegated viewer, or a raw-code
 * fallback).
 */

/** Character offsets of a block within the original markdown source. */
export interface BlockRange {
  /** Inclusive start offset into the original markdown. */
  start: number;
  /** Exclusive end offset into the original markdown. */
  end: number;
}

/**
 * One embedded block inside a rich-Markdown document.
 *
 * `kind` is an **open** discriminator (`'mermaid' | 'dot' | 'ics' | 'canvas' | …`)
 * so new block kinds need no contract change. `svg` is the pre-built-SVG fallback
 * contract: when a kind has no live renderer, the provider ships a rendered SVG
 * so the block never degrades to a raw code dump. This type is **data only** —
 * no DOM, no React — so it stays node-testable and is what a {@link BlockRenderer}
 * receives.
 */
export interface RichMarkdownBlock {
  /** Open block-kind discriminator, e.g. `'mermaid'`, `'dot'`, `'ics'`, `'canvas'`. */
  kind: string;
  /** Verbatim block source (the fenced-code body). */
  source: string;
  /**
   * Content hash of `source` (e.g. `'sha256:…'`). A stable identity used for
   * caching and as a fast-path key when matching a rendered prose fence back to
   * its provider block. Matching also works without it (by normalized source).
   */
  hash?: string;
  /** Character offsets of the block in the original markdown source. */
  range?: BlockRange;
  /**
   * Pre-built SVG markup — the fallback contract for blocks with no live
   * renderer. When present the block renders this SVG instead of raw code.
   */
  svg?: string;
  /** Optional human-facing caption/label for the block. */
  title?: string;
}

/**
 * What a block renderer decided to produce.
 *
 * - `mermaid` — hand the source to the live Mermaid path (renders to SVG client-side).
 * - `svg` — inline a pre-built SVG (the fallback contract).
 * - `viewer` — delegate to a **viewer** resolved by registry `key`, handing it
 *   the pure-data `data` payload (e.g. a `'calendar-month'` viewer rendering a
 *   `CalendarModel`). This is the seam that lets a structured block render
 *   through a full node/model viewer rather than a static SVG.
 * - `unsupported` — no live renderer and no SVG; show the raw source as a last resort.
 */
export type BlockOutput =
  | { type: 'mermaid'; source: string; title?: string }
  | { type: 'svg'; svg: string; title?: string }
  | { type: 'viewer'; key: string; data: unknown; title?: string }
  | { type: 'unsupported'; kind: string; source: string; reason: string };

/** Context threaded to renderers (e.g. for theme-aware live rendering). */
export interface BlockRenderContext {
  /** Active dark/light flag, for renderers that theme their output. */
  isDark?: boolean;
}

/** A block renderer maps a block to a {@link BlockOutput} decision. */
export type BlockRenderer = (
  block: RichMarkdownBlock,
  ctx?: BlockRenderContext,
) => BlockOutput;
