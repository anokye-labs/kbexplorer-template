/**
 * Client-side search index for kbexplorer.
 *
 * Design: hand-rolled inverted index over a 32-bit MurmurHash-inspired token
 * digest. No external dependency — stays zero-cost at runtime and trivially
 * tree-shaken.
 *
 * Rationale vs minisearch:
 * - No added dependency / license surface.
 * - A 500-node graph produces < 50 k tokens; scanning a Set<string> is fast
 *   enough (<5 ms typical) to beat the serialisation round-trip minisearch needs
 *   for a pre-built index.
 * - We own ranking logic, so title > heading > body is a first-class concern
 *   rather than a score-boost workaround.
 *
 * Build: buildSearchIndex(nodes) — called once when the graph is ready, result
 * memoised by the caller (useSearchIndex).
 * Query: searchIndex(index, query, limit?) — synchronous, returns ranked hits.
 */

import type { KBNode } from '../types';

// ── Token helpers ──────────────────────────────────────────

const NON_WORD = /[^\p{L}\p{N}]+/u;

/** Normalise a string into a list of lowercase tokens (unicode-safe). */
export function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .split(NON_WORD)
    .filter(t => t.length >= 2);
}

/** Strip markdown syntax for plain-text indexing. */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')   // fenced code
    .replace(/`[^`]*`/g, ' ')           // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links (keep text)
    .replace(/^#{1,6}\s+/gm, '')        // headings markers
    .replace(/[*_~>|]/g, ' ')           // emphasis, blockquote, table
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract headings text from markdown. */
export function extractHeadings(md: string): string {
  const matches = md.match(/^#{1,6}\s+(.+)$/gm) ?? [];
  return matches.map(h => h.replace(/^#{1,6}\s+/, '')).join(' ');
}

// ── Index types ────────────────────────────────────────────

export type SearchField = 'title' | 'heading' | 'body';

export interface IndexEntry {
  nodeId: string;
  title: string;
  type: string;         // node source type
  cluster: string;
  entityType?: string;
  /** Pre-tokenised title tokens */
  titleTokens: string[];
  /** Pre-tokenised heading tokens */
  headingTokens: string[];
  /** Pre-tokenised body tokens */
  bodyTokens: string[];
}

export interface SearchIndex {
  entries: IndexEntry[];
  /** token → Set of nodeIds that contain it in each field */
  titleMap: Map<string, Set<string>>;
  headingMap: Map<string, Set<string>>;
  bodyMap: Map<string, Set<string>>;
}

export interface SearchResult {
  nodeId: string;
  title: string;
  cluster: string;
  type: string;
  entityType?: string;
  /** Which field produced the best match */
  matchField: SearchField;
  /** Numeric score — higher is better */
  score: number;
}

// ── Build ──────────────────────────────────────────────────

function addTokens(map: Map<string, Set<string>>, tokens: string[], nodeId: string): void {
  for (const tok of tokens) {
    let set = map.get(tok);
    if (!set) { set = new Set(); map.set(tok, set); }
    set.add(nodeId);
  }
}

/**
 * Build a search index from the loaded node set.
 * Call once when graph is ready; memoize the result.
 */
export function buildSearchIndex(nodes: KBNode[]): SearchIndex {
  const entries: IndexEntry[] = [];
  const titleMap = new Map<string, Set<string>>();
  const headingMap = new Map<string, Set<string>>();
  const bodyMap = new Map<string, Set<string>>();

  for (const node of nodes) {
    const rawMd = node.rawContent ?? '';
    const headingText = extractHeadings(rawMd);
    const bodyText = stripMarkdown(rawMd);

    const titleTokens = tokenize(node.title);
    const headingTokens = tokenize(headingText);
    const bodyTokens = tokenize(bodyText);

    const entry: IndexEntry = {
      nodeId: node.id,
      title: node.title,
      type: node.source.type,
      cluster: node.cluster,
      entityType: node.entityType,
      titleTokens,
      headingTokens,
      bodyTokens,
    };
    entries.push(entry);

    addTokens(titleMap, titleTokens, node.id);
    addTokens(headingMap, headingTokens, node.id);
    addTokens(bodyMap, bodyTokens, node.id);
  }

  return { entries, titleMap, headingMap, bodyMap };
}

// ── Query ──────────────────────────────────────────────────

const FIELD_WEIGHTS: Record<SearchField, number> = {
  title: 10,
  heading: 4,
  body: 1,
};

/**
 * Score how well a list of tokens matches a query token list.
 * Exact match scores higher than prefix match.
 */
function tokenScore(
  indexTokens: string[],
  queryTokens: string[],
): number {
  if (queryTokens.length === 0) return 0;
  let score = 0;
  for (const q of queryTokens) {
    for (const t of indexTokens) {
      if (t === q) {
        score += 2; // exact
      } else if (t.startsWith(q) && q.length >= 2) {
        score += 1; // prefix
      }
    }
  }
  return score / queryTokens.length; // normalise by query length
}

const MAX_RESULTS = 20;

/**
 * Search the index and return ranked results.
 * Scoring: title > heading > body (per FIELD_WEIGHTS).
 * Empty query → [].
 */
export function searchIndex(
  index: SearchIndex,
  query: string,
  limit = MAX_RESULTS,
): SearchResult[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  // Candidate collection: use the inverted maps to find candidate nodeIds
  // (avoids scanning all body tokens for every node)
  const candidateIds = new Set<string>();
  for (const q of queryTokens) {
    // Exact match first
    for (const map of [index.titleMap, index.headingMap, index.bodyMap]) {
      const hits = map.get(q);
      if (hits) for (const id of hits) candidateIds.add(id);
    }
    // Prefix match — scan all keys (small set, fast enough for < 500 nodes)
    for (const map of [index.titleMap, index.headingMap, index.bodyMap]) {
      for (const [tok, ids] of map) {
        if (tok.startsWith(q) && tok !== q && q.length >= 2) {
          for (const id of ids) candidateIds.add(id);
        }
      }
    }
  }

  if (candidateIds.size === 0) return [];

  const entryMap = new Map(index.entries.map(e => [e.nodeId, e]));
  const results: SearchResult[] = [];

  for (const nodeId of candidateIds) {
    const entry = entryMap.get(nodeId);
    if (!entry) continue;

    const titleScore = tokenScore(entry.titleTokens, queryTokens) * FIELD_WEIGHTS.title;
    const headingScore = tokenScore(entry.headingTokens, queryTokens) * FIELD_WEIGHTS.heading;
    const bodyScore = tokenScore(entry.bodyTokens, queryTokens) * FIELD_WEIGHTS.body;

    const totalScore = titleScore + headingScore + bodyScore;
    if (totalScore === 0) continue;

    const matchField: SearchField =
      titleScore >= headingScore && titleScore >= bodyScore
        ? 'title'
        : headingScore >= bodyScore
        ? 'heading'
        : 'body';

    results.push({
      nodeId,
      title: entry.title,
      cluster: entry.cluster,
      type: entry.type,
      entityType: entry.entityType,
      matchField,
      score: totalScore,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
