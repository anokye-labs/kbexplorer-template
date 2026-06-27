/** Core data types for the kbexplorer knowledge graph. */

import {
  buildJsonLd,
  type BrandingConfig,
  type Cluster,
  type Connection,
  type DisplayMode,
  type EdgeSource,
  type EdgeType,
  type ExternalProviderConfig,
  type FluentBrandRamp,
  type FluentBrandRampKey,
  type JsonLd,
  type KBConfig,
  type KBEdge,
  type KBGraph,
  type KBNode,
  type KnownDisplayMode,
  type KnownEdgeType,
  type NodeSource,
  type NodeSourceFile,
  type PageTheme,
  type SourceConfig,
  type Theme,
  type VisualMode,
} from '@anokye-labs/kbexplorer-core';
import { resolveNodeLayer } from '../engine/node-types/registry';
import { projectReportsToTree } from '../engine/reports-to-layout';

/**
 * Re-export the pure graph + config contract from `@anokye-labs/kbexplorer-core`
 * so existing `../types` imports keep working unchanged. The styling, layout,
 * view, node-layer and default-config logic below stays template-local — it is
 * representation/engine concern, not pure data.
 */
export {
  buildJsonLd,
  type BrandingConfig,
  type Cluster,
  type Connection,
  type DisplayMode,
  type EdgeSource,
  type EdgeType,
  type ExternalProviderConfig,
  type FluentBrandRamp,
  type FluentBrandRampKey,
  type JsonLd,
  type KBConfig,
  type KBEdge,
  type KBGraph,
  type KBNode,
  type KnownDisplayMode,
  type KnownEdgeType,
  type NodeSource,
  type NodeSourceFile,
  type PageTheme,
  type SourceConfig,
  type Theme,
  type VisualMode,
};


/** A single entry in nodemap.yaml */
export interface NodeMapEntry {
  id: string;
  title?: string;
  emoji?: string;      // Fluent icon name
  cluster?: string;
  display?: DisplayMode;
  connections?: 'imports' | 'references' | Connection[];
  exclude?: string[];

  // Mapping modes (exactly one must be set)
  file?: string;           // single file → 1 node
  files?: string[];        // multiple files → 1 merged node
  glob?: string;           // glob pattern → N nodes
  directory?: string;      // directory → 1 tree node

  // Split options (only with file:)
  split?: 'headings';      // split file at ## headings

  // Glob options
  each?: 'file';           // each match becomes a node
  titleFrom?: 'filename' | 'heading';  // how to derive title
}

/** Parsed nodemap.yaml */
export interface NodeMap {
  nodes: NodeMapEntry[];
}







/**
 * The open relationship taxonomy carried by {@link KBEdge.relation}.
 *
 * These six relations come from the content model and are rendered in the
 * legend data-drivenly. `relation` is an open string — unknown relations still
 * render with a sensible default style.
 */
export type KnownRelation =
  | 'leads'
  | 'staffs'
  | 'reports-to'
  | 'structural'
  | 'derived'
  | 'deprecated'
  // Work-graph organizational-layer relations (#233)
  | 'owns'
  | 'has-priority'
  | 'tracked-in'
  // Person-node active-work relations (#235)
  | 'assigned-to'
  | 'authored'
  | 'member-of';

/** Default weights per edge type — higher = tighter layout clustering */
export const EDGE_TYPE_WEIGHTS: Record<KnownEdgeType, number> = {
  contains: 5.0,
  derived_from: 3.0,
  imports: 2.0,
  references: 2.0,
  frontmatter: 1.5,
  cross_references: 1.5,
  modifies: 1.0,
  closes: 2.0,
  mentions: 0.5,
  related: 0.3,
};

/** Visual style for each edge type */
export interface EdgeTypeStyle {
  color: string;
  dashes: boolean | number[];
  width: number;
  label: string;
}

export const EDGE_TYPE_STYLES: Record<KnownEdgeType, EdgeTypeStyle> = {
  contains:         { color: '#a0adb8', dashes: false,      width: 2,   label: 'Contains' },
  derived_from:     { color: '#e8a854', dashes: false,      width: 2,   label: 'Derived from' },
  imports:          { color: '#a78bfa', dashes: false,      width: 1.5, label: 'Imports' },
  references:       { color: '#79c0ff', dashes: false,      width: 1.5, label: 'References' },
  frontmatter:      { color: '#7ee787', dashes: [6, 4],     width: 1.5, label: 'Frontmatter' },
  cross_references: { color: '#f9a8d4', dashes: false,      width: 1.5, label: 'Cross-ref' },
  modifies:         { color: '#e3b341', dashes: [4, 4],     width: 1.5, label: 'Modifies' },
  closes:           { color: '#56d364', dashes: false,      width: 2,   label: 'Closes' },
  mentions:         { color: '#b1bac4', dashes: [3, 4],     width: 1.2, label: 'Mentions' },
  related:          { color: '#8b949e', dashes: [3, 3],     width: 1.2, label: 'Related' },
};

/** Visual styles for the relation taxonomy (rendered data-drivenly in the legend). */
export const RELATION_STYLES: Record<KnownRelation, EdgeTypeStyle> = {
  leads:            { color: '#f0883e', dashes: false,     width: 2.5, label: 'Leads' },
  staffs:           { color: '#3fb950', dashes: false,     width: 1.5, label: 'Staffs' },
  'reports-to':     { color: '#a371f7', dashes: false,     width: 1.8, label: 'Reports to' },
  structural:       { color: '#a0adb8', dashes: false,     width: 2,   label: 'Structural' },
  derived:          { color: '#e8a854', dashes: [6, 4],    width: 1.5, label: 'Derived' },
  deprecated:       { color: '#8b949e', dashes: [2, 3],    width: 1.2, label: 'Deprecated' },
  // Work-graph organizational-layer relations (#233)
  owns:             { color: '#4A9CC8', dashes: false,     width: 2,   label: 'Owns' },
  'has-priority':   { color: '#E8A838', dashes: [4, 3],    width: 1.8, label: 'Has priority' },
  'tracked-in':     { color: '#a371f7', dashes: [6, 3],    width: 1.5, label: 'Tracked in' },
  // Person-node active-work relations (#235)
  'assigned-to':    { color: '#56d364', dashes: false,     width: 1.8, label: 'Assigned to' },
  'authored':       { color: '#79c0ff', dashes: [4, 3],    width: 1.5, label: 'Authored' },
  'member-of':      { color: '#f0883e', dashes: false,     width: 1.8, label: 'Member of' },
};

const DEFAULT_RELATION_STYLE: EdgeTypeStyle = { color: '#79c0ff', dashes: [2, 2], width: 1.5, label: 'Related' };

/** Title-case an arbitrary relation/edge key for display in the legend. */
function humanizeKey(key: string): string {
  return key
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Resolve the visual style for an edge, data-drivenly.
 *
 * Precedence: explicit `relation` (taxonomy → known style; otherwise a default
 * style with a humanized label) → known `type` style → for an unknown (open)
 * `type`, the neutral `related` visual style but with the actual type string
 * humanized as the label so new edge kinds still render distinctly in the
 * legend. This is the single source of truth used by both the graph renderer
 * and the legend so new relations show up without code edits.
 */
export function getEdgeStyle(edge: { type?: EdgeType; relation?: string }): EdgeTypeStyle {
  if (edge.relation) {
    const known = RELATION_STYLES[edge.relation as KnownRelation];
    if (known) return known;
    return { ...DEFAULT_RELATION_STYLE, label: humanizeKey(edge.relation) };
  }
  const t = (edge.type ?? 'related') as KnownEdgeType;
  const known = EDGE_TYPE_STYLES[t];
  if (known) return known;
  // Open/unknown edge type: keep the neutral `related` visual treatment but
  // preserve the actual type string as a humanized label so F2/F3 relations are
  // distinguishable in the data-driven legend.
  return { ...EDGE_TYPE_STYLES.related, label: humanizeKey(edge.type as string) };
}

/** The legend key for an edge — its relation when present, else its type. */
export function getEdgeLegendKey(edge: { type?: EdgeType; relation?: string }): string {
  return edge.relation ?? (edge.type as string) ?? 'related';
}

/** Resolve the layout weight for an edge type (open-safe). */
export function getEdgeWeight(type: EdgeType | undefined): number {
  return EDGE_TYPE_WEIGHTS[(type ?? 'related') as KnownEdgeType] ?? 1;
}

export type NodeLayer = 'file' | 'content' | 'work';

export const NODE_LAYER_META: Record<NodeLayer, { label: string; color: string }> = {
  file:    { label: 'Files',   color: '#9A8A78' },
  content: { label: 'Content', color: '#58a6ff' },
  work:    { label: 'Work',    color: '#d29922' },
};

/**
 * Classify a node into a graph layer.
 *
 * Registry-driven: resolution delegates to the node-type registry
 * ({@link resolveNodeLayer}), which honors `entityType` first, then the
 * `source.type`, falling back to `'file'`. Built-in source types are registered
 * with their historical layer mapping so existing graphs classify identically.
 */
export function getNodeLayer(node: KBNode): NodeLayer {
  return resolveNodeLayer(node);
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

function filterByPredicate(graph: KBGraph, predicate: (n: KBNode) => boolean): KBGraph {
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

// ── Graph Views ────────────────────────────────────────────

/** Layout strategy a view requests for the live graph canvas. */
export type GraphLayoutMode = 'force' | 'reports-to'

/** A named view projection over the graph */
export interface GraphView {
  id: string
  name: string
  icon: string
  color: string
  /**
   * Layout strategy for this view's graph. Defaults to the force-directed
   * constellation when omitted. `'reports-to'` renders a hierarchical org tree
   * keyed on the reporting relation (#279).
   */
  layout?: GraphLayoutMode
  /** Resolve this view — custom logic, not just a filter */
  resolve: (graph: KBGraph) => KBGraph
}

/** Built-in views — each with a custom resolver */
export const BUILT_IN_VIEWS: GraphView[] = [
  {
    id: 'all',
    name: 'All',
    icon: '',
    color: '#ffffff',
    resolve: (graph) => graph,
  },
  {
    id: 'code',
    name: 'Code',
    icon: 'Code',
    color: '#9A8A78',
    resolve: (graph) => filterByPredicate(graph, n => {
      const t = n.source.type
      if (t === 'file') return true
      // Include authored nodes in code-related clusters
      if ((t === 'authored' || t === 'derived') &&
        ['engine', 'data', 'infra'].includes(n.cluster)) return true
      return false
    }),
  },
  {
    id: 'content',
    name: 'Docs',
    icon: 'Document',
    color: '#58a6ff',
    resolve: (graph) => filterGraphToLayer(graph, 'content'),
  },
  {
    id: 'work',
    name: 'Work',
    icon: 'Wrench',
    color: '#d29922',
    resolve: (graph) => filterByPredicate(graph, n => {
      const t = n.source.type
      if (t === 'structured' && n.entityType === 'person') return true
      return t === 'issue' || t === 'pull_request' || t === 'commit' || t === 'branch' || t === 'workflow' || t === 'repository' || t === 'release' || t === 'person'
    }),
  },
  {
    id: 'external',
    name: 'External',
    icon: 'Globe',
    color: '#79C0FF',
    resolve: (graph) => {
      // External nodes + their 1-hop internal neighbors
      const externalIds = new Set(
        graph.nodes.filter(n => n.source.type === 'external').map(n => n.id)
      )
      const neighborIds = new Set<string>()
      for (const e of graph.edges) {
        if (externalIds.has(e.from)) neighborIds.add(e.to)
        if (externalIds.has(e.to)) neighborIds.add(e.from)
      }
      const visibleIds = new Set([...externalIds, ...neighborIds])
      return filterByPredicate(graph, n => visibleIds.has(n.id))
    },
  },
  {
    id: 'org',
    name: 'Org',
    icon: 'Organization',
    // Matches the `reports-to` relation colour so the org tree reads as a
    // first-class projection of the reporting hierarchy (#279).
    color: '#a371f7',
    layout: 'reports-to',
    resolve: (graph) => projectReportsToTree(graph),
  },
]

/** Get a view by ID (built-in or custom) */
export function getView(id: string): GraphView | undefined {
  return BUILT_IN_VIEWS.find(v => v.id === id)
}

/** Apply a view to a graph */
export function filterGraphToView(graph: KBGraph, viewId: string): KBGraph {
  if (viewId === 'all') return graph
  const view = getView(viewId)
  if (!view) return graph
  return view.resolve(graph)
}

/**
 * Collapse specified clusters into single summary nodes.
 * Each collapsed cluster's nodes are replaced with one summary node;
 * edges to/from collapsed nodes are remapped to the summary.
 */
export function collapseGraphClusters(graph: KBGraph, collapsedIds: Set<string>): KBGraph {
  if (collapsedIds.size === 0) return graph;

  const collapsedNodeIds = new Map<string, string>(); // original id → summary id
  const summaryNodes: KBNode[] = [];

  for (const clusterId of collapsedIds) {
    const cluster = graph.clusters.find(c => c.id === clusterId);
    if (!cluster) continue;
    const clusterNodes = graph.nodes.filter(n => n.cluster === clusterId);
    if (clusterNodes.length === 0) continue;

    const summaryId = `cluster-${clusterId}`;
    for (const n of clusterNodes) collapsedNodeIds.set(n.id, summaryId);

    summaryNodes.push({
      id: summaryId,
      title: `${cluster.name} (${clusterNodes.length})`,
      cluster: clusterId,
      content: '',
      rawContent: '',
      emoji: clusterNodes[0]?.emoji,
      connections: [],
      source: { type: 'file', path: '' },
    });
  }

  // Keep non-collapsed nodes + add summary nodes
  const nodes = [
    ...graph.nodes.filter(n => !collapsedNodeIds.has(n.id)),
    ...summaryNodes,
  ];

  // Remap edges: replace collapsed node refs with their summary
  const remap = (id: string) => collapsedNodeIds.get(id) ?? id;
  const edgeSeen = new Set<string>();
  const edges: KBEdge[] = [];
  for (const e of graph.edges) {
    const from = remap(e.from);
    const to = remap(e.to);
    if (from === to) continue; // skip intra-cluster edges
    const key = `${from}→${to}→${e.type}`;
    if (edgeSeen.has(key)) continue;
    edgeSeen.add(key);
    edges.push({ ...e, from, to });
  }

  // Rebuild related — for summary nodes, aggregate from constituent nodes
  const nodeIdSet = new Set(nodes.map(n => n.id));
  const related: Record<string, string[]> = {};

  // Aggregate related for collapsed clusters → summary nodes
  for (const [originalId, summaryId] of collapsedNodeIds) {
    const origRelated = graph.related[originalId] ?? [];
    const existing = related[summaryId] ?? [];
    existing.push(...origRelated.map(remap));
    related[summaryId] = existing;
  }

  // Process non-collapsed nodes + deduplicate summary related
  for (const n of nodes) {
    if (n.id.startsWith('cluster-')) {
      // Deduplicate summary node's aggregated related
      related[n.id] = [...new Set(related[n.id] ?? [])].filter(id => id !== n.id && nodeIdSet.has(id));
      if (related[n.id].length === 0) delete related[n.id];
    } else {
      const originalRelated = graph.related[n.id] ?? [];
      const mapped = [...new Set(originalRelated.map(remap))].filter(id => id !== n.id && nodeIdSet.has(id));
      if (mapped.length > 0) related[n.id] = mapped;
    }
  }

  return { nodes, edges, clusters: graph.clusters, related };
}

/** Hard visibility limits for the rendered graph. */
export const MAX_VISIBLE_NODES = 40
export const MAX_VISIBLE_EDGES = 80

export interface TrimResult {
  graph: KBGraph
  trimmed: boolean
  totalNodes: number
  totalEdges: number
}

/**
 * Cap graph to MAX_VISIBLE_NODES / MAX_VISIBLE_EDGES.
 * Selection strategy:
 * 1. Always keep the hub node and current node
 * 2. Reserve 1-hop neighbors of the current node
 * 3. Ensure at least 1 node per cluster (cluster floor)
 * 4. Fill remaining slots by degree (most connected first)
 * 5. After node trim, cap edges — prefer current-node edges, then by weight
 */
export function trimGraphToLimits(
  graph: KBGraph,
  currentNodeId?: string | null,
  maxNodes = MAX_VISIBLE_NODES,
  maxEdges = MAX_VISIBLE_EDGES,
): TrimResult {
  const totalNodes = graph.nodes.length
  const totalEdges = graph.edges.length

  if (totalNodes <= maxNodes && totalEdges <= maxEdges) {
    return { graph, trimmed: false, totalNodes, totalEdges }
  }

  // Build degree map
  const degree = new Map<string, number>()
  for (const n of graph.nodes) degree.set(n.id, 0)
  for (const e of graph.edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1)
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1)
  }

  // Find hub
  let hubId: string | null = null
  let hubDeg = -1
  for (const [id, d] of degree) {
    if (d > hubDeg) { hubId = id; hubDeg = d }
  }
  // Prefer home/readme/overview as hub
  if (graph.nodes.some(n => n.id === 'home')) hubId = 'home'
  else if (graph.nodes.some(n => n.id === 'readme')) hubId = 'readme'
  else if (graph.nodes.some(n => n.id === 'overview')) hubId = 'overview'

  const kept = new Set<string>()

  // 1. Hub + current node + readme (always visible)
  if (hubId) kept.add(hubId)
  if (currentNodeId && degree.has(currentNodeId)) kept.add(currentNodeId)
  if (graph.nodes.some(n => n.id === 'readme')) kept.add('readme')

  // 2. Current node's 1-hop neighbors
  if (currentNodeId) {
    const neighbors: { id: string; deg: number }[] = []
    for (const e of graph.edges) {
      if (e.from === currentNodeId && degree.has(e.to)) neighbors.push({ id: e.to, deg: degree.get(e.to)! })
      if (e.to === currentNodeId && degree.has(e.from)) neighbors.push({ id: e.from, deg: degree.get(e.from)! })
    }
    neighbors.sort((a, b) => b.deg - a.deg)
    const neighborBudget = Math.min(Math.floor(maxNodes * 0.3), neighbors.length)
    for (let i = 0; i < neighborBudget; i++) kept.add(neighbors[i].id)
  }

  // 3. Cluster floor — at least 1 node per cluster
  const clusters = new Set(graph.nodes.map(n => n.cluster).filter(Boolean))
  for (const cid of clusters) {
    if ([...kept].some(id => graph.nodes.find(n => n.id === id)?.cluster === cid)) continue
    // Pick highest-degree node from this cluster
    const best = graph.nodes
      .filter(n => n.cluster === cid)
      .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))[0]
    if (best && kept.size < maxNodes) kept.add(best.id)
  }

  // 4. External provider boost — reserve slots for external nodes proportional to budget
  const externalNodes = graph.nodes.filter(n => n.source.type === 'external')
  if (externalNodes.length > 0) {
    // Reserve up to 20% of budget for external nodes (at least 2)
    const externalBudget = Math.max(2, Math.floor(maxNodes * 0.2))
    const externalToAdd = externalNodes
      .filter(n => !kept.has(n.id))
      .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
    for (const n of externalToAdd) {
      if (kept.size >= maxNodes) break
      const externalKept = [...kept].filter(id =>
        graph.nodes.find(nd => nd.id === id)?.source.type === 'external'
      ).length
      if (externalKept >= externalBudget) break
      kept.add(n.id)
    }
  }

  // 5. Fill remaining by degree
  const byDegree = [...graph.nodes]
    .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
  for (const n of byDegree) {
    if (kept.size >= maxNodes) break
    kept.add(n.id)
  }

  // Build trimmed node list
  const nodes = graph.nodes.filter(n => kept.has(n.id))

  // Keep ALL edges between visible nodes (no edge cap — visual importance handles density)
  const edges = graph.edges.filter(e => kept.has(e.from) && kept.has(e.to))

  // Rebuild related
  const nodeIdSet = new Set(nodes.map(n => n.id))
  const related: Record<string, string[]> = {}
  for (const id of nodeIdSet) {
    const r = (graph.related[id] ?? []).filter(rid => nodeIdSet.has(rid))
    if (r.length > 0) related[id] = r
  }

  return {
    graph: { nodes, edges, clusters: graph.clusters, related },
    trimmed: true,
    totalNodes,
    totalEdges,
  }
}














/** Resolve the default source config from Vite env vars or fallback to hardcoded defaults. */
function resolveDefaultSource(): SourceConfig {
  const owner = import.meta.env.VITE_KB_OWNER;
  const repo = import.meta.env.VITE_KB_REPO;
  if (owner && repo) {
    return {
      owner,
      repo,
      branch: import.meta.env.VITE_KB_BRANCH ?? 'main',
      path: import.meta.env.VITE_KB_PATH || undefined,
    };
  }
  return { owner: 'anokye-labs', repo: 'kbexplorer', path: 'content', branch: 'main' };
}

/** Default configuration for repo-aware mode. */
export const DEFAULT_CONFIG: KBConfig = {
  title: import.meta.env.VITE_KB_TITLE ?? 'kbexplorer',
  subtitle: 'Interactive Knowledge Base Explorer',
  author: 'Anokye Labs',
  source: resolveDefaultSource(),
  clusters: {
    // Each cluster may also carry an optional `tokens` delta (Fluent token name
    // → CSS value, same shape as theme.tokens) to shift only that cluster's
    // scoped surfaces (cards/badges/reading header). Omitted here so defaults
    // inherit the active global theme unchanged.
    feature: { name: 'Feature', color: '#4A9CC8' },
    task: { name: 'Task', color: '#8CB050' },
    bug: { name: 'Bug', color: '#C04040' },
    epic: { name: 'Epic', color: '#E8A838' },
    code: { name: 'Code', color: '#9A8A78' },
    docs: { name: 'Documentation', color: '#D4A050' },
    'pull-request': { name: 'Pull Request', color: '#A86FDF' },
    commits: { name: 'Commits', color: '#5A98A8' },
    releases: { name: 'Releases', color: '#F78166' },
  },
  visuals: {
    mode: 'emoji',
    fallback: 'emoji',
  },
  theme: {
    default: 'dark',
    font: {
      heading: "'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif",
      body: "'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif",
      mono: "'Cascadia Code', 'Cascadia Mono', Consolas, monospace",
    },
    // brand / tokens / themes are optional, additive overrides (see KBConfig.theme).
    // Left unset by default so the built-in dark/light/sepia themes are unchanged.
    // themesFile (also unset by default) may point at a dedicated theme file in the
    // host repo (e.g. "content/themes/extra.yaml"); when set it is fetched at runtime
    // like config.yaml and its named themes are merged into the THEME_MAP, overriding
    // any inline theme.themes of the same name. Unset ⇒ no fetch, no behavior change.
    // moduleUrl (T5.3, also unset by default) is the most powerful escape hatch: a
    // SECURITY-sensitive opt-in that dynamically import()s a host-provided ESM JS
    // module exporting a Fluent Theme / BrandVariants and registers it into the
    // THEME_MAP. Off by default ⇒ no import, pure no-op. Only set it for a module you
    // trust (ideally self-hosted in this repo) and tighten CSP accordingly — see the
    // theming docs' CSP note.
  },
  graph: {
    physics: true,
    layout: 'force-atlas-2',
  },
  features: {
    hud: true,
    minimap: true,
    readingTools: true,
    keyboardNav: true,
    sparkAnimation: false,
    search: true,
  },
  // branding omitted by default — host repos may set branding.logo (a repo-relative
  // image path) to render a logo on the HomePage hero and HUD header, and
  // branding.favicon (a repo-relative image path) to swap the document favicon at
  // runtime, and branding.css (a repo-relative path or URL) to inject a raw CSS
  // override sheet last in <head> for full control over --colorNeutral*/
  // --colorBrand*/--kbe-* variables. Text title and the static /favicon.svg are
  // used as graceful fallbacks; branding.css is unset by default so nothing is
  // injected.
};
