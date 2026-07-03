/**
 * Named graph-view projections for the SPA canvas. Views resolve a graph into a
 * focused sub-graph (and optionally request a layout). This is representation
 * logic — it consults graph-layer projection + the engine reports-to layout —
 * and is kept out of the pure `../types` data contract.
 */
import type { KBGraph } from '../types';
import { filterByPredicate, filterGraphToLayer } from './graph-layers';
import { projectReportsToTree } from './graph-canvas/reports-to-layout';

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
