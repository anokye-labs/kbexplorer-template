/**
 * `llm-context` representation (Phase 6 / F6 #337, §4B).
 *
 * A neighbor-anchored Markdown pack for feeding an LLM. It is ALWAYS anchored
 * on one or more context nodes — it NEVER serializes the whole graph. It emits:
 *
 *   1. each anchor's full content (anchors are always present, regardless of
 *      budget);
 *   2. the anchors' nearest neighbors, ranked by the engine's existing
 *      edge-weight scoring (`graph.related`), expanded into the pack until a
 *      token budget is exhausted;
 *   3. navigable `kg://` links (core {@link ResourceLink} hypermedia) for the
 *      relevant-but-unexpanded neighbors, so the LLM can follow a hyperlink to
 *      retrieve more on demand — web/REST-resource-inspired.
 *
 * Markdown is chosen over JSON for token efficiency. Determinism: the same
 * graph + same anchors + same budget produce byte-identical output. `tokenBudget`
 * bounds ONLY the neighborhood expansion — anchors are always fully emitted.
 */
import {
  stripScheme,
  type Representation,
  type RepresentationOptions,
  type ResourceLink,
} from '@anokye-labs/kbexplorer-core';
import type { KBEdge, KBGraph, KBNode } from '../../types';
import { nodeUrn } from './urn';

/** Default neighborhood-expansion token budget when none is supplied. */
export const DEFAULT_LLM_CONTEXT_TOKEN_BUDGET = 2000;

/** Coarse, deterministic token estimate (~4 chars/token). */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** A node's body for the pack: prefer raw markdown, else stripped HTML. */
function nodeBody(node: KBNode): string {
  const raw = (node.rawContent ?? '').trim();
  if (raw) return raw;
  const stripped = (node.content ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped || '_(no content)_';
}

/** The highest-weight edge connecting `neighborId` to any anchor (deterministic). */
function bestAnchorEdge(
  graph: KBGraph,
  anchorIds: string[],
  neighborId: string,
): KBEdge | undefined {
  let best: KBEdge | undefined;
  for (const anchorId of anchorIds) {
    for (const edge of graph.edges) {
      const connects =
        (edge.from === anchorId && edge.to === neighborId) ||
        (edge.from === neighborId && edge.to === anchorId);
      if (connects && (best === undefined || edge.weight > best.weight)) {
        best = edge;
      }
    }
  }
  return best;
}

/** Relation label for a neighbor edge: explicit relation, else structural type. */
function relationLabel(edge: KBEdge | undefined): string {
  return edge?.relation ?? edge?.type ?? 'related';
}

function weightLabel(edge: KBEdge | undefined): string {
  return (edge?.weight ?? 0).toFixed(2);
}

/** Markdown block for an expanded neighbor (used for both costing and output). */
function neighborBlock(node: KBNode, edge: KBEdge | undefined): string {
  return [
    `### ${node.title}`,
    '',
    `\`${nodeUrn(node)}\` · ${relationLabel(edge)} · weight ${weightLabel(edge)}`,
    '',
    nodeBody(node),
  ].join('\n');
}

/** De-duplicate ids preserving first-seen order. */
function dedupe(ids: string[]): string[] {
  return [...new Set(ids)];
}

/**
 * Render a neighbor-anchored, token-budgeted Markdown context pack.
 *
 * @throws if no anchors are supplied or an anchor id is absent from the graph —
 * an empty/invalid anchor set is an error for this neighbor-anchored target.
 */
export function renderLlmContext(
  graph: KBGraph,
  options: RepresentationOptions = {},
): string {
  const anchorIds = dedupe(options.anchors ?? []);
  if (anchorIds.length === 0) {
    throw new Error(
      'llm-context is neighbor-anchored: options.anchors must list at least one node id.',
    );
  }
  const budget = options.tokenBudget ?? DEFAULT_LLM_CONTEXT_TOKEN_BUDGET;

  const byId = new Map(graph.nodes.map(node => [node.id, node]));
  const anchors = anchorIds.map(id => {
    const node = byId.get(id);
    if (!node) {
      throw new Error(`llm-context anchor "${id}" not found in graph.`);
    }
    return node;
  });

  // Ranked candidate neighbors: walk each anchor's weight-ranked `related`
  // list in order, collecting unseen, in-graph, non-anchor nodes.
  const seen = new Set(anchorIds);
  const candidates: string[] = [];
  for (const anchorId of anchorIds) {
    for (const neighborId of graph.related[anchorId] ?? []) {
      if (seen.has(neighborId) || !byId.has(neighborId)) continue;
      seen.add(neighborId);
      candidates.push(neighborId);
    }
  }

  // Greedily expand neighbors in rank order until the budget is exhausted;
  // every remaining (relevant) neighbor becomes a navigable kg:// link.
  const expanded: { node: KBNode; edge: KBEdge | undefined }[] = [];
  const unexpanded: { node: KBNode; edge: KBEdge | undefined }[] = [];
  let used = 0;
  let full = false;
  for (const id of candidates) {
    const node = byId.get(id)!;
    const edge = bestAnchorEdge(graph, anchorIds, id);
    if (!full) {
      const cost = estimateTokens(neighborBlock(node, edge));
      if (used + cost <= budget) {
        expanded.push({ node, edge });
        used += cost;
        continue;
      }
      full = true;
    }
    unexpanded.push({ node, edge });
  }

  const out: string[] = [];
  out.push('# Knowledge graph context');
  out.push('');
  out.push(
    `- Anchored on ${anchors.length} node(s); neighbor expansion budget ≈ ${budget} tokens.`,
  );
  out.push(
    `- ${expanded.length} neighbor(s) expanded, ${unexpanded.length} linked for navigation.`,
  );
  out.push('');

  for (const anchor of anchors) {
    out.push(`## Anchor — ${anchor.title}`);
    out.push('');
    out.push(`\`${nodeUrn(anchor)}\``);
    out.push('');
    out.push(nodeBody(anchor));
    out.push('');
  }

  if (expanded.length > 0) {
    out.push('## Expanded neighbors');
    out.push('');
    for (const { node, edge } of expanded) {
      out.push(neighborBlock(node, edge));
      out.push('');
    }
  }

  if (unexpanded.length > 0) {
    out.push('## Navigate — follow `kg://` links for more');
    out.push('');
    for (const { node, edge } of unexpanded) {
      const link: ResourceLink = {
        rel: relationLabel(edge),
        href: nodeUrn(node),
        type: node.entityType,
        title: node.title,
      };
      out.push(
        `- [${link.title}](${link.href}) · ${link.rel} · weight ${weightLabel(edge)} · \`${stripScheme(link.href)}\``,
      );
    }
    out.push('');
  }

  return out.join('\n').replace(/\n+$/, '\n');
}

/** The registered `llm-context` representation target. */
export const llmContextRepresentation: Representation<string> = {
  target: 'llm-context',
  render(graph, options) {
    return renderLlmContext(graph, options);
  },
};
