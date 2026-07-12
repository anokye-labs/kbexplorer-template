/**
 * Rich-Markdown document contract (Wave 0b — #427).
 *
 * A rich-Markdown node carries an open `data.richMarkdown` bag emitted by the
 * provider (anokye-labs/kbexplorer-cli#133). It pairs the document's prose
 * (`node.content` / `node.rawContent`) with a list of **embedded blocks** — each
 * a fenced region (`mermaid` / `dot` / `ics` / `canvas` / …) the provider lifts
 * out, hashes, and (for kinds with no live renderer) pre-renders to SVG.
 *
 * These are **data only** — no DOM, no React — so they stay node-testable. The
 * block-renderer registry ({@link ./registry}) turns a block into a render
 * decision; the React/DOM layer turns that decision into pixels.
 */
import type { KBNode } from '../../types';
import type { BlockRange, RichMarkdownBlock } from '@anokye-labs/kbexplorer-view-kit';

/**
 * The block-data contract (`BlockRange`, `RichMarkdownBlock`) now lives in the
 * published render contract `@anokye-labs/kbexplorer-view-kit` so a provider's
 * render half and this host agree on exactly one block shape. Re-exported here
 * so existing `./types` importers keep working unchanged.
 */
export type { BlockRange, RichMarkdownBlock };

/** The structured payload carried on `node.data.richMarkdown`. */
export interface RichMarkdownDocument {
  /** Frontmatter facts surfaced in the structured view. */
  frontmatter?: Record<string, unknown>;
  /** Embedded blocks, in document order. */
  blocks: RichMarkdownBlock[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Narrow + validate a single raw block into a {@link RichMarkdownBlock}. */
function coerceBlock(raw: unknown): RichMarkdownBlock | null {
  if (!isObject(raw)) return null;
  if (typeof raw.kind !== 'string' || typeof raw.source !== 'string') return null;

  const block: RichMarkdownBlock = { kind: raw.kind, source: raw.source };
  if (typeof raw.hash === 'string') block.hash = raw.hash;
  if (typeof raw.svg === 'string') block.svg = raw.svg;
  if (typeof raw.title === 'string') block.title = raw.title;
  if (
    isObject(raw.range) &&
    typeof raw.range.start === 'number' &&
    typeof raw.range.end === 'number'
  ) {
    block.range = { start: raw.range.start, end: raw.range.end };
  }
  return block;
}

/**
 * Read + validate a node's `data.richMarkdown` into a {@link RichMarkdownDocument}.
 *
 * Returns `null` when the node carries no (valid) rich-Markdown payload, so a
 * caller can cleanly fall back to plain prose rendering. Malformed blocks are
 * skipped rather than throwing — a single bad block must never blank the page.
 */
export function getRichMarkdownDocument(
  node: Pick<KBNode, 'data'>,
): RichMarkdownDocument | null {
  const rm = node.data?.richMarkdown;
  if (!isObject(rm)) return null;

  const rawBlocks = Array.isArray(rm.blocks) ? rm.blocks : [];
  const blocks = rawBlocks
    .map(coerceBlock)
    .filter((b): b is RichMarkdownBlock => b !== null);

  const doc: RichMarkdownDocument = { blocks };
  if (isObject(rm.frontmatter)) doc.frontmatter = rm.frontmatter;
  return doc;
}

/** True when a node carries a valid rich-Markdown payload. */
export function isRichMarkdownNode(node: Pick<KBNode, 'data'>): boolean {
  return getRichMarkdownDocument(node) !== null;
}

/**
 * Normalize a block's source for stable comparison: CRLF → LF, strip trailing
 * per-line whitespace, then trim ends. Lets a rendered prose fence be matched to
 * its provider block regardless of incidental whitespace differences.
 */
export function normalizeBlockSource(source: string): string {
  return source.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
}

/**
 * Compute a stable content hash of a block's (normalized) source.
 *
 * Uses a dependency-free, synchronous FNV-1a so it works identically in the
 * browser and in node tests. The provider may emit a stronger hash (e.g.
 * `sha256:…`); block matching never depends on the algorithm (it falls back to
 * normalized-source equality), so this stays an honest, illustrative identity.
 */
export function hashBlockSource(source: string): string {
  const normalized = normalizeBlockSource(source);
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
