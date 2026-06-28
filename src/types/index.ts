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
  GRAPH_STORE_API_VERSION,
  GRAPH_STORE_CACHE_KEY_VERSION,
  formatContentHash,
  formatGraphStoreCacheKey,
  type ContentHash,
  type ContentHashAlgorithm,
  type ContentHashEncoding,
  type GraphStore,
  type GraphStoreCacheKey,
  type GraphStoreCacheScope,
  type GraphStoreDependency,
  type GraphStoreEntry,
  type GraphStoreInvalidation,
  type GraphStoreWrite,
} from '@anokye-labs/kbexplorer-core';

/**
 * Re-export the pure graph + config contract from `@anokye-labs/kbexplorer-core`
 * so existing `../types` imports keep working unchanged. The default-config
 * logic and the pure graph projections below (collapse/trim) stay template-local
 * but engine-free; styling, layer and view representation now live under
 * `../representation` (Phase 2 / F2 #309) so this module imports nothing from the
 * engine at load.
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
  GRAPH_STORE_API_VERSION,
  GRAPH_STORE_CACHE_KEY_VERSION,
  formatContentHash,
  formatGraphStoreCacheKey,
  type ContentHash,
  type ContentHashAlgorithm,
  type ContentHashEncoding,
  type GraphStore,
  type GraphStoreCacheKey,
  type GraphStoreCacheScope,
  type GraphStoreDependency,
  type GraphStoreEntry,
  type GraphStoreInvalidation,
  type GraphStoreWrite,
};

/**
 * Backward-compatible re-exports of the representation styling moved to
 * `../representation/styles` (Phase 2 / T2.1 #310). These are pure data — no
 * engine import — so re-exporting them keeps `../types` engine-free at load.
 * New code should import these from `../representation/styles` directly.
 */
export {
  EDGE_TYPE_WEIGHTS,
  EDGE_TYPE_STYLES,
  RELATION_STYLES,
  NODE_LAYER_META,
  getEdgeStyle,
  getEdgeLegendKey,
  getEdgeWeight,
  type EdgeTypeStyle,
  type NodeLayer,
} from '../representation/styles';


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
