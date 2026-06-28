/**
 * `json-ld` representation (Phase 6 / F6 #336).
 *
 * Serializes the pure `KBGraph` into a deterministic JSON-LD document using
 * core's {@link buildJsonLd} helper (so each node's `@id` reuses its identity
 * URN and `@type` is never path-derived). Output is canonicalized — recursively
 * sorted keys, nodes sorted by id, relation links sorted by target URN — so the
 * same graph emits byte-identical bytes across runs.
 */
import {
  buildJsonLd,
  type JsonLd,
  type Representation,
} from '@anokye-labs/kbexplorer-core';
import type { KBGraph, KBNode } from '../../types';
import { nodeUrn } from './urn';

const CONTEXT = 'https://schema.org';

/** The JSON-LD document emitted for a whole graph: a `@graph` of node envelopes. */
export interface GraphJsonLd {
  '@context': string;
  '@graph': JsonLd[];
}

/** `@type` for a node: reuse its LD type / entityType; never path-derived. */
function nodeType(node: KBNode): string | string[] {
  const ldType = node.jsonld?.['@type'];
  if (ldType !== undefined) return ldType;
  if (node.entityType) return node.entityType;
  return 'Thing';
}

/** Build the JSON-LD `@graph` document from a pure KBGraph (no I/O). */
export function buildGraphJsonLd(graph: KBGraph): GraphJsonLd {
  const urnById = new Map(graph.nodes.map(node => [node.id, nodeUrn(node)]));

  const nodes = [...graph.nodes].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );

  const envelopes = nodes.map(node => {
    const related = [
      ...new Set(
        graph.edges
          .filter(edge => edge.from === node.id && urnById.has(edge.to))
          .map(edge => urnById.get(edge.to)!),
      ),
    ].sort();

    const data: Record<string, unknown> = { name: node.title };
    if (related.length > 0) {
      data.isRelatedTo = related.map(href => ({ '@id': href }));
    }

    return buildJsonLd(node, nodeType(node), data, CONTEXT);
  });

  return { '@context': CONTEXT, '@graph': envelopes };
}

/** Recursively key-sorted JSON (arrays keep order) for byte-stable output. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) out[key] = canonicalize(obj[key]);
    return out;
  }
  return value;
}

/** Serialize a graph to deterministic JSON-LD text (trailing newline). */
export function serializeGraphJsonLd(graph: KBGraph): string {
  return JSON.stringify(canonicalize(buildGraphJsonLd(graph)), null, 2) + '\n';
}

/** The registered `json-ld` representation target. */
export const jsonLdRepresentation: Representation<string> = {
  target: 'json-ld',
  render(graph) {
    return serializeGraphJsonLd(graph);
  },
};
