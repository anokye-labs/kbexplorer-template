/**
 * Reports-to tree layout (#279).
 *
 * Pure, SSR-safe helpers that project the knowledge graph down to the
 * `reports-to` reporting hierarchy and compute a per-node tree *level* for a
 * vis-network hierarchical layout. No DOM / vis-network imports here so the
 * logic stays unit-testable and safe to run during SSR.
 *
 * Edge convention (content-model/schema/edges.yaml `person-manager`):
 *   reports-to edge.from = the report (subordinate, has a `manager`)
 *   reports-to edge.to   = the manager (the parent in the tree)
 * So a manager sits one level ABOVE their reports. Level 0 = top of the org.
 *
 * The level map and projection scale to a hundreds-person org in O(V + E):
 * a single breadth-first sweep from the roots assigns shortest-path depth,
 * which is also the natural level for a (mostly) tree-shaped reporting graph.
 */
import type { KBGraph, KBNode, KBEdge } from '../../types';

/** The relation taxonomy key for a reporting edge. */
export const REPORTS_TO_RELATION = 'reports-to';

/**
 * Default upper bound on nodes rendered in the org tree. Protects the live
 * vis-network from pathological inputs; when exceeded the tree is truncated
 * breadth-first from the roots so the kept subtree stays connected. HUD shows a
 * "showing N of M" note when this kicks in.
 */
export const DEFAULT_MAX_TREE_NODES = 600;

/** Whether a node represents a person (descriptor or work-derived). */
export function isPersonNode(node: KBNode): boolean {
  return node.entityType === 'person' || node.source?.type === 'person';
}

/** All `reports-to` edges in the graph (unfiltered by node type). */
export function selectReportsToEdges(graph: KBGraph): KBEdge[] {
  return graph.edges.filter(e => e.relation === REPORTS_TO_RELATION);
}

/** Reports-to edges whose endpoints are both person nodes in this graph. */
function personReportsToEdges(graph: KBGraph): KBEdge[] {
  const personIds = new Set(graph.nodes.filter(isPersonNode).map(n => n.id));
  return selectReportsToEdges(graph).filter(
    e => personIds.has(e.from) && personIds.has(e.to),
  );
}

/** Whether the graph contains a meaningful person→person reporting tree. */
export function hasReportsToTree(graph: KBGraph): boolean {
  return personReportsToEdges(graph).length > 0;
}

/** Number of distinct people participating in the reporting tree. */
export function countReportsToParticipants(graph: KBGraph): number {
  const ids = new Set<string>();
  for (const e of personReportsToEdges(graph)) {
    ids.add(e.from);
    ids.add(e.to);
  }
  return ids.size;
}

interface TreeShape {
  /** parent id → sorted child ids (parent = manager, child = report). */
  children: Map<string, string[]>;
  /** Every person that appears in a reporting edge. */
  participants: Set<string>;
  /** Roots (people with no manager), deterministically sorted. */
  roots: string[];
}

/** Build the manager→reports adjacency from person reports-to edges. */
function buildTreeShape(edges: KBEdge[]): TreeShape {
  const children = new Map<string, string[]>();
  const participants = new Set<string>();
  const hasManager = new Set<string>();

  for (const e of edges) {
    const child = e.from; // report
    const parent = e.to; // manager
    participants.add(child);
    participants.add(parent);
    hasManager.add(child);
    let kids = children.get(parent);
    if (!kids) {
      kids = [];
      children.set(parent, kids);
    }
    kids.push(child);
  }

  // Deterministic ordering so layouts are stable across runs.
  for (const kids of children.values()) kids.sort();
  const roots = [...participants].filter(id => !hasManager.has(id)).sort();

  return { children, participants, roots };
}

/**
 * Compute a tree level for each person in the reporting hierarchy.
 *
 * Level 0 = roots (people with no manager). A report is one level below its
 * manager. Cycle-safe (a node is leveled at most once); any person left
 * unreached by the root sweep — only possible inside a reporting cycle — is
 * promoted to a fresh root so the whole org still renders. Non-person nodes and
 * non-reporting edges are ignored.
 */
export function computeReportsToLevels(graph: KBGraph): Map<string, number> {
  const edges = personReportsToEdges(graph);
  const { children, participants, roots } = buildTreeShape(edges);
  const level = new Map<string, number>();

  // BFS from every root simultaneously → shortest-path depth = tree level.
  const sweep = (start: string) => {
    const queue: string[] = [start];
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      const d = level.get(cur)!;
      for (const child of children.get(cur) ?? []) {
        if (!level.has(child)) {
          level.set(child, d + 1);
          queue.push(child);
        }
      }
    }
  };

  for (const r of roots) {
    if (!level.has(r)) {
      level.set(r, 0);
      sweep(r);
    }
  }

  // Cycle remnants: any participant not yet leveled becomes its own root.
  for (const p of [...participants].sort()) {
    if (!level.has(p)) {
      level.set(p, 0);
      sweep(p);
    }
  }

  return level;
}

/** Breadth-first set of node ids to keep when the tree exceeds the cap. */
function truncateToCap(shape: TreeShape, cap: number): Set<string> {
  const keep = new Set<string>();
  const queue = [...shape.roots];
  let head = 0;
  // Seed: if there are no roots (pure cycle), start from sorted participants.
  if (queue.length === 0) queue.push(...[...shape.participants].sort());
  while (head < queue.length && keep.size < cap) {
    const cur = queue[head++];
    if (keep.has(cur)) continue;
    keep.add(cur);
    for (const child of shape.children.get(cur) ?? []) {
      if (!keep.has(child)) queue.push(child);
    }
  }
  return keep;
}

/**
 * Project the graph down to the reporting tree: only person nodes that take
 * part in a `reports-to` relationship and the reporting edges between them.
 *
 * Returns an empty graph (no nodes) when there is no reporting tree, so the
 * org view honestly shows nothing rather than the whole constellation. When the
 * tree exceeds `maxNodes` it is truncated breadth-first from the roots so the
 * kept subtree stays connected and rooted.
 */
export function projectReportsToTree(
  graph: KBGraph,
  maxNodes: number = DEFAULT_MAX_TREE_NODES,
): KBGraph {
  const edges = personReportsToEdges(graph);
  if (edges.length === 0) {
    return { nodes: [], edges: [], clusters: graph.clusters, related: {} };
  }

  const shape = buildTreeShape(edges);
  const keep =
    shape.participants.size > maxNodes
      ? truncateToCap(shape, maxNodes)
      : shape.participants;

  const nodes = graph.nodes.filter(n => keep.has(n.id));
  const keptEdges = edges.filter(e => keep.has(e.from) && keep.has(e.to));

  // Rebuild `related` restricted to kept nodes so downstream UI never points at
  // a node that was projected out.
  const related: Record<string, string[]> = {};
  for (const n of nodes) {
    const prior = graph.related[n.id];
    if (prior) related[n.id] = prior.filter(id => keep.has(id));
  }

  return { nodes, edges: keptEdges, clusters: graph.clusters, related };
}
