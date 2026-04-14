/** Core data types for the kbexplorer knowledge graph. */

export type DisplayMode = 'prose' | 'code' | 'file-list' | 'tree' | 'table' | 'diagram';

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

/** A node in the knowledge graph. */
export interface KBNode {
  id: string;
  title: string;
  cluster: string;
  content: string; // HTML rendered from markdown
  rawContent: string; // Original markdown
  emoji?: string;
  image?: string; // path relative to repo root (heroes mode)
  sprite?: string; // path relative to repo root (sprites mode)
  parent?: string; // parent node id (for hierarchy)
  nodeType?: 'parent' | 'section'; // parent has children, section is a child
  /** How this node's content should be rendered */
  display?: DisplayMode;
  connections: Connection[];
  /** Canonical identity URN linking representations across providers */
  identity?: string;
  /** Whether this node's content was machine-derived (can be re-generated) */
  derived?: boolean;
  /** Source of this node: authored markdown or GitHub artifact */
  source: NodeSource;
  /** Which provider created this node */
  provider?: string;
}

export type EdgeType =
  | 'contains'
  | 'derived_from'
  | 'imports'
  | 'references'
  | 'frontmatter'
  | 'mentions'
  | 'cross_references'
  | 'modifies'
  | 'closes'
  | 'related';

export type EdgeSource = 'inline' | 'frontmatter' | 'inferred';

/** Default weights per edge type — higher = tighter layout clustering */
export const EDGE_TYPE_WEIGHTS: Record<EdgeType, number> = {
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

export const EDGE_TYPE_STYLES: Record<EdgeType, EdgeTypeStyle> = {
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

export type NodeLayer = 'file' | 'content' | 'work';

export const NODE_LAYER_META: Record<NodeLayer, { label: string; color: string }> = {
  file:    { label: 'Files',   color: '#9A8A78' },
  content: { label: 'Content', color: '#58a6ff' },
  work:    { label: 'Work',    color: '#d29922' },
};

/** Classify a node into a graph layer based on its source. */
export function getNodeLayer(node: KBNode): NodeLayer {
  const t = node.source.type;
  if (t === 'authored' || t === 'readme' || t === 'derived') return 'content';
  if (t === 'section') return 'content';
  if (t === 'issue' || t === 'pull_request' || t === 'commit') return 'work';
  return 'file';
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
  // Prefer readme/overview as hub
  if (graph.nodes.some(n => n.id === 'readme')) hubId = 'readme'
  else if (graph.nodes.some(n => n.id === 'overview')) hubId = 'overview'

  const kept = new Set<string>()

  // 1. Hub + current node
  if (hubId) kept.add(hubId)
  if (currentNodeId && degree.has(currentNodeId)) kept.add(currentNodeId)

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

  // 4. Fill by degree
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

export interface Connection {
  to: string;
  type?: EdgeType;
  description: string;
  source?: EdgeSource;
  weight?: number;
}

export interface Cluster {
  id: string;
  name: string;
  color: string;
}

/** Computed graph data, ready for visualization. */
export interface KBGraph {
  nodes: KBNode[];
  edges: KBEdge[];
  clusters: Cluster[];
  related: Record<string, string[]>; // nodeId → related nodeIds (max 8)
}

export interface KBEdge {
  from: string;
  to: string;
  type: EdgeType;
  description: string;
  source: EdgeSource;
  weight: number;
}

/** Visual identity mode. */
export type VisualMode = 'sprites' | 'heroes' | 'emoji' | 'none';

/** Theme preference. */
export type Theme = 'dark' | 'light' | 'sepia';

/** Content source configuration. */
export interface SourceConfig {
  owner: string;
  repo: string;
  path?: string; // content directory within repo (authored mode)
  branch?: string; // default: main
}

/** Where a node originated from. */
export type NodeSource =
  | { type: 'authored'; file: string }
  | { type: 'issue'; number: number; state: string; labels: string[] }
  | { type: 'pull_request'; number: number; state: string }
  | { type: 'commit'; sha: string }
  | { type: 'file'; path: string }
  | { type: 'readme' }
  | { type: 'section'; parentSource: NodeSource }
  | { type: 'derived'; generator: string }
  | { type: 'external'; provider: string };

/** Configuration for an external provider plugin */
export interface ExternalProviderConfig {
  /** Provider type identifier */
  type: 'wikipedia' | 'orgchart' | 'custom';
  /** Human-readable name */
  name?: string;
  /** Cluster to assign nodes to */
  cluster?: string;
  /** Provider-specific options */
  options?: Record<string, unknown>;
}

/** Full knowledge base configuration (from config.yaml). */
export interface KBConfig {
  title: string;
  subtitle?: string;
  author?: string;
  date?: string;
  source: SourceConfig;
  clusters: Record<string, { name: string; color: string }>;
  visuals: {
    mode: VisualMode;
    fallback: VisualMode;
    hero?: {
      overlay?: 'dark-gradient' | 'light-gradient' | 'none';
      height?: string;
      animation?: 'reveal' | 'fade' | 'none';
    };
    hud?: {
      blurBackground?: boolean;
      blurOpacity?: number;
    };
    graph?: {
      nodeImages?: boolean;
      nodeSizeByConnections?: boolean;
    };
  };
  theme: {
    default: Theme;
    font?: {
      heading?: string;
      body?: string;
      mono?: string;
    };
  };
  graph: {
    physics: boolean;
    layout: 'force-atlas-2' | 'manual';
  };
  features: {
    hud: boolean;
    minimap: boolean;
    readingTools: boolean;
    keyboardNav: boolean;
    sparkAnimation: boolean;
  };
  providers?: ExternalProviderConfig[];
  bluf?: {
    audio?: string;
    quote?: string;
    duration?: string;
  };
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
    feature: { name: 'Feature', color: '#4A9CC8' },
    task: { name: 'Task', color: '#8CB050' },
    bug: { name: 'Bug', color: '#C04040' },
    epic: { name: 'Epic', color: '#E8A838' },
    code: { name: 'Code', color: '#9A8A78' },
    docs: { name: 'Documentation', color: '#D4A050' },
    'pull-request': { name: 'Pull Request', color: '#A86FDF' },
    commits: { name: 'Commits', color: '#5A98A8' },
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
  },
};
