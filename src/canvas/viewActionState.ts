/**
 * Reason-aware `graph-updated` view-action reducer (#409, epic #407).
 *
 * The frozen loopback contract's canvas actions (`kbexplorer-cli` cli#214,
 * `docs/canvas-loopback-contract.md`) deliver the agent-invoked `expand` /
 * `trace` / `filter` operations as the SAME `graph-updated` SSE event, not a
 * separate event type — distinguished by a `reason` field:
 *
 * - `expand`  → `{ reason: 'expand', nodes: [nodeId, ...neighborIds], focus }`
 * - `trace`   → `{ reason: 'trace', nodes: path, path, connected }`
 * - `filter`  → `{ reason: 'filter', filter: { query?, cluster?, nodeType? }, nodes }`
 *   — `nodes` is the matched id array when `filter.query` was given, else
 *   `null` (a cluster/nodeType-only filter with no query term — the frozen
 *   contract has no server-side seam for that case; the panel is expected to
 *   apply the predicate client-side against the manifest it already has, see
 *   {@link resolveFilterNodeIds}).
 *
 * IMPORTANT: in every reason-carrying payload, `nodes` is an array of PLAIN
 * ID STRINGS — a different shape from the legacy, reason-less
 * `graph-updated { nodes: [{ id, ...fields }] }` content-patch payload that
 * {@link applyGraphUpdatedEvent} (`useCanvasEvents.ts`) still handles. This
 * reducer and that one are deliberately kept separate and are dispatched by
 * the caller based on whether `reason` is present (see `EmbeddableApp.tsx`).
 */
import type { KBGraph } from '../types';

/** A resolved `trace` result: the path found (or attempted) and whether it connects. */
export interface TraceResult {
  path: string[];
  connected: boolean;
}

/** The recorded `filter` criteria. `nodeIds: null` means "resolve client-side" — see {@link resolveFilterNodeIds}. */
export interface FilterCriteria {
  nodeIds: string[] | null;
  query?: string;
  cluster?: string;
  nodeType?: string;
}

/**
 * Accumulated state from every `expand` / `trace` / `filter` view-action
 * received over the life of the `/events` connection. Immutable — each
 * {@link applyViewAction} call returns a new object (or the SAME reference
 * when a payload doesn't apply, so callers can use it directly as a
 * `setState` updater without an extra equality check).
 */
export interface ViewActionState {
  /**
   * Every node id ever named by an `expand` action's `nodes` field, ADDED
   * across calls (never replaced/cleared) — an agent expanding several nodes
   * across a conversation keeps them all visible.
   */
  expandedNodeIds: ReadonlySet<string>;
  /** The most recent `expand`'s `focus` node id, if any. */
  focusNodeId?: string;
  /** The most recent `trace` result. A new trace REPLACES the prior one. */
  trace?: TraceResult;
  /** The most recent `filter` criteria. A new filter REPLACES the prior one. */
  filter?: FilterCriteria;
}

export const INITIAL_VIEW_ACTION_STATE: ViewActionState = {
  expandedNodeIds: new Set(),
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(v => typeof v === 'string' && v.length > 0);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

/**
 * Apply one `graph-updated` SSE payload to the running {@link ViewActionState}.
 * Branches on `reason`; payloads with no `reason` (the legacy content-patch
 * shape) or an unrecognized `reason` are NOT this reducer's concern and are
 * returned unchanged (never throws — see `useCanvasEvents.ts` for the
 * complementary legacy-patch reducer and the dispatch that picks between them).
 */
export function applyViewAction(state: ViewActionState, payload: unknown): ViewActionState {
  if (!isPlainObject(payload)) return state;

  switch (payload.reason) {
    case 'expand': {
      const nodes = payload.nodes;
      if (!isStringArray(nodes) || nodes.length === 0) return state;
      const expandedNodeIds = new Set(state.expandedNodeIds);
      for (const id of nodes) expandedNodeIds.add(id);
      const focus = payload.focus;
      return {
        ...state,
        expandedNodeIds,
        focusNodeId: typeof focus === 'string' && focus.length > 0 ? focus : state.focusNodeId,
      };
    }

    case 'trace': {
      const path = payload.path;
      if (!isStringArray(path)) return state;
      return { ...state, trace: { path, connected: payload.connected === true } };
    }

    case 'filter': {
      const nodes = payload.nodes;
      if (nodes !== null && !isStringArray(nodes)) return state;
      const filter = isPlainObject(payload.filter) ? payload.filter : {};
      return {
        ...state,
        filter: {
          nodeIds: nodes,
          query: typeof filter.query === 'string' ? filter.query : undefined,
          cluster: typeof filter.cluster === 'string' ? filter.cluster : undefined,
          nodeType: typeof filter.nodeType === 'string' ? filter.nodeType : undefined,
        },
      };
    }

    default:
      // No reason, or a reason this reducer doesn't know about — a no-op
      // here, not a crash. `useCanvasEvents.ts`'s `applyGraphUpdatedEvent`
      // handles the reason-less legacy shape.
      return state;
  }
}

/**
 * Resolve the EFFECTIVE set of visible node ids for the active filter, doing
 * the client-side `cluster`/`nodeType` predicate the frozen contract punts to
 * the panel when the server sent `nodeIds: null` (see the module doc's
 * "filter" bullet and the contract's own "Honesty note on filter"). Returns
 * `undefined` when no filter is active (nothing to constrain) — callers
 * should treat that as "show everything".
 *
 * When `nodeIds` is `null` and NEITHER `cluster` nor `nodeType` is set (a
 * malformed/empty filter), also returns `undefined` — there's nothing to
 * filter by, so the caller degrades to "no-op" rather than hiding everything.
 */
export function resolveFilterNodeIds(
  filter: FilterCriteria | undefined,
  graph: Pick<KBGraph, 'nodes'>,
): Set<string> | undefined {
  if (!filter) return undefined;
  if (filter.nodeIds !== null) return new Set(filter.nodeIds);
  if (!filter.cluster && !filter.nodeType) return undefined;
  const matched = graph.nodes.filter(
    node =>
      (!filter.cluster || node.cluster === filter.cluster) &&
      (!filter.nodeType || node.entityType === filter.nodeType),
  );
  return new Set(matched.map(node => node.id));
}
