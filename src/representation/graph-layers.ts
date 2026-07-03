/**
 * Graph-layer projection — classifies nodes into file/content/work layers and
 * filters the graph to a single layer. The resolved layer is stamped onto the
 * graph data at build time, so representation can consume pure node data without
 * consulting the engine registry.
 */
import type { KBGraph, KBNode, KBEdge } from '../types';
import type { NodeLayer } from '../types/node-layer';

/**
 * Classify a node into a graph layer.
 *
 * The layer is carried on the graph data contract and defaults to `'file'` when
 * absent for backward compatibility with older graphs.
 */
export function getNodeLayer(node: KBNode): NodeLayer {
  return node.layer ?? 'file';
}

/** Check if a file node is a redundant content/ tree entry (has an authored counterpart). */
export function isContentTreeNode(node: KBNode): boolean {
  if (node.source.type !== 'file') return false;
  const path = (node.source as { path: string }).path;
  return path.startsWith('content/') || path === 'content';
}

/**
 * Filter graph to a single layer view.
 * - Files: only file-layer nodes
 * - Content: authored nodes + referenced file nodes (excluding content/ tree duplicates)
 * - Work: issues, PRs, commits
 */
export function filterGraphToLayer(graph: KBGraph, layer: NodeLayer): KBGraph {
  if (layer === 'file') {
    return filterByPredicate(graph, n => getNodeLayer(n) === 'file');
  }

  if (layer === 'content') {
    // Start with all content nodes
    const contentIds = new Set<string>();
    for (const n of graph.nodes) {
      if (getNodeLayer(n) === 'content') contentIds.add(n.id);
    }

    // Identity-aware: find file nodes that share identity with content nodes
    // and remap their edges to the content node
    const identityToContentId = new Map<string, string>();
    for (const n of graph.nodes) {
      if (n.identity && contentIds.has(n.id)) {
        identityToContentId.set(n.identity, n.id);
      }
    }
    const fileIdToContentId = new Map<string, string>();
    for (const n of graph.nodes) {
      if (n.identity && !contentIds.has(n.id) && identityToContentId.has(n.identity)) {
        fileIdToContentId.set(n.id, identityToContentId.get(n.identity)!);
      }
    }

    // Add file nodes referenced by content nodes (but not content/ tree duplicates or identity-mapped)
    const referencedFileIds = new Set<string>();
    for (const e of graph.edges) {
      if (contentIds.has(e.from) && !contentIds.has(e.to) && !fileIdToContentId.has(e.to)) {
        const target = graph.nodes.find(n => n.id === e.to);
        if (target && getNodeLayer(target) === 'file' && !isContentTreeNode(target)) {
          referencedFileIds.add(e.to);
        }
      }
      if (contentIds.has(e.to) && !contentIds.has(e.from) && !fileIdToContentId.has(e.from)) {
        const target = graph.nodes.find(n => n.id === e.from);
        if (target && getNodeLayer(target) === 'file' && !isContentTreeNode(target)) {
          referencedFileIds.add(e.from);
        }
      }
    }
    const visibleIds = new Set([...contentIds, ...referencedFileIds]);

    // Filter nodes
    const nodes = graph.nodes.filter(n => visibleIds.has(n.id));

    // Filter edges — remap identity-linked file node refs to their content counterpart
    const remap = (id: string) => fileIdToContentId.get(id) ?? id;
    const edgeSeen = new Set<string>();
    const edges: KBEdge[] = [];
    for (const e of graph.edges) {
      const from = remap(e.from);
      const to = remap(e.to);
      if (!visibleIds.has(from) || !visibleIds.has(to)) continue;
      if (from === to) continue;
      const key = `${from}→${to}→${e.type}`;
      if (edgeSeen.has(key)) continue;
      edgeSeen.add(key);
      edges.push({ ...e, from, to });
    }

    const related: Record<string, string[]> = {};
    for (const id of visibleIds) {
      const r = (graph.related[id] ?? [])
        .map(remap)
        .filter(rid => rid !== id && visibleIds.has(rid));
      const unique = [...new Set(r)];
      if (unique.length > 0) related[id] = unique;
    }
    return { nodes, edges, clusters: graph.clusters, related };
  }

  // Work layer: issues, PRs, commits
  return filterByPredicate(graph, n => getNodeLayer(n) === 'work');
}

export function filterByPredicate(graph: KBGraph, predicate: (n: KBNode) => boolean): KBGraph {
  const visibleIds = new Set<string>();
  const nodes = graph.nodes.filter(n => {
    if (predicate(n)) { visibleIds.add(n.id); return true; }
    return false;
  });
  const edges = graph.edges.filter(e => visibleIds.has(e.from) && visibleIds.has(e.to));
  const related: Record<string, string[]> = {};
  for (const id of visibleIds) {
    const r = (graph.related[id] ?? []).filter(rid => visibleIds.has(rid));
    if (r.length > 0) related[id] = r;
  }
  return { nodes, edges, clusters: graph.clusters, related };
}
