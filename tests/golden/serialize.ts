/**
 * Deterministic KBGraph serializer for golden-output guardrails (Phase 0).
 *
 * Produces byte-stable canonical JSON from a {@link KBGraph} so two builds of
 * the same inputs serialize identically. The graph builder is already
 * deterministic; this module additionally canonicalizes ordering and object-key
 * order so the committed golden fixture is robust to incidental reordering.
 *
 * Rules:
 * - Object keys are emitted in sorted order, recursively.
 * - `nodes` are sorted by `id`; `edges` by `(from, to, type, relation)`;
 *   `clusters` by `id`. These keys are unique/total orders, so sorting is safe.
 * - `related` keys are sorted; each value array preserves its ranked order
 *   (the ranking is semantically meaningful and already deterministic).
 * - Output ends with a trailing newline so the file is POSIX-clean.
 */
import type { KBGraph, KBNode, KBEdge, Cluster } from '../../src/types';

/** Recursively sort object keys; arrays keep their element order. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = canonicalize(obj[key]);
    }
    return out;
  }
  return value;
}

function compareNodes(a: KBNode, b: KBNode): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function edgeKey(e: KBEdge): string {
  return `${e.from}\u0000${e.to}\u0000${e.type}\u0000${e.relation ?? ''}`;
}

function compareEdges(a: KBEdge, b: KBEdge): number {
  const ka = edgeKey(a);
  const kb = edgeKey(b);
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

function compareClusters(a: Cluster, b: Cluster): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Build a canonical, ordering-stable representation of a KBGraph. */
export function canonicalGraph(graph: KBGraph): unknown {
  const nodes = [...graph.nodes].sort(compareNodes);
  const edges = [...graph.edges].sort(compareEdges);
  const clusters = [...graph.clusters].sort(compareClusters);
  const related: Record<string, string[]> = {};
  for (const key of Object.keys(graph.related).sort()) {
    related[key] = graph.related[key];
  }
  return canonicalize({ nodes, edges, clusters, related });
}

/** Serialize a KBGraph to deterministic, byte-stable JSON (trailing newline). */
export function serializeGraph(graph: KBGraph): string {
  return JSON.stringify(canonicalGraph(graph), null, 2) + '\n';
}

export function normalizeGoldenText(text: string): string {
  return text.replace(/\r\n/g, '\n');
}
