import { describe, expect, it } from 'vitest';
import {
  applyViewAction,
  resolveFilterNodeIds,
  INITIAL_VIEW_ACTION_STATE,
  type ViewActionState,
} from '../viewActionState';
import type { KBGraph, KBNode } from '../../types';

/**
 * Reason-aware `graph-updated` view-action reducer (#409, cli#214). Payload
 * shapes here match the frozen `kbexplorer-cli` contract exactly:
 * - expand: { reason: 'expand', nodes: [nodeId, ...neighborIds], focus }
 * - trace:  { reason: 'trace', nodes: path, path, connected }
 * - filter: { reason: 'filter', filter: { query?, cluster?, nodeType? }, nodes }
 */

function node(overrides: Partial<KBNode> & { id: string }): KBNode {
  return {
    title: overrides.id,
    cluster: 'default',
    content: '',
    rawContent: '',
    connections: [],
    source: { type: 'authored' } as unknown as KBNode['source'],
    ...overrides,
  };
}

function graphWith(nodes: KBNode[]): KBGraph {
  return { nodes, edges: [], clusters: [], related: {} };
}

describe('applyViewAction — expand (#409, cli#214)', () => {
  it('unions expand nodes into expandedNodeIds (never replaces)', () => {
    let state = INITIAL_VIEW_ACTION_STATE;
    state = applyViewAction(state, { reason: 'expand', nodes: ['a', 'b'], focus: 'a' });
    expect([...state.expandedNodeIds]).toEqual(['a', 'b']);
    expect(state.focusNodeId).toBe('a');

    state = applyViewAction(state, { reason: 'expand', nodes: ['c'], focus: 'c' });
    // 'a' and 'b' from the FIRST expand are still present — additive, not replaced.
    expect([...state.expandedNodeIds]).toEqual(['a', 'b', 'c']);
    expect(state.focusNodeId).toBe('c');
  });

  it('keeps the prior focus when a later expand omits focus', () => {
    let state = applyViewAction(INITIAL_VIEW_ACTION_STATE, {
      reason: 'expand',
      nodes: ['a'],
      focus: 'a',
    });
    state = applyViewAction(state, { reason: 'expand', nodes: ['b'] });
    expect(state.focusNodeId).toBe('a');
    expect([...state.expandedNodeIds]).toEqual(['a', 'b']);
  });

  it('is a no-op for a malformed expand payload (missing/empty/non-string nodes)', () => {
    const state = INITIAL_VIEW_ACTION_STATE;
    expect(applyViewAction(state, { reason: 'expand' })).toBe(state);
    expect(applyViewAction(state, { reason: 'expand', nodes: [] })).toBe(state);
    expect(applyViewAction(state, { reason: 'expand', nodes: [1, 2] })).toBe(state);
    expect(applyViewAction(state, { reason: 'expand', nodes: 'a' })).toBe(state);
  });
});

describe('applyViewAction — trace (#409, cli#214)', () => {
  it('records the path and connected flag', () => {
    const state = applyViewAction(INITIAL_VIEW_ACTION_STATE, {
      reason: 'trace',
      nodes: ['a', 'b', 'c'],
      path: ['a', 'b', 'c'],
      connected: true,
    });
    expect(state.trace).toEqual({ path: ['a', 'b', 'c'], connected: true });
  });

  it('records connected:false when the path does not connect', () => {
    const state = applyViewAction(INITIAL_VIEW_ACTION_STATE, {
      reason: 'trace',
      path: ['a', 'z'],
      connected: false,
    });
    expect(state.trace).toEqual({ path: ['a', 'z'], connected: false });
  });

  it('a later trace REPLACES the prior one (not additive)', () => {
    let state = applyViewAction(INITIAL_VIEW_ACTION_STATE, {
      reason: 'trace',
      path: ['a', 'b'],
      connected: true,
    });
    state = applyViewAction(state, { reason: 'trace', path: ['x', 'y'], connected: false });
    expect(state.trace).toEqual({ path: ['x', 'y'], connected: false });
  });

  it('is a no-op for a malformed trace payload (missing/non-string path)', () => {
    const state = INITIAL_VIEW_ACTION_STATE;
    expect(applyViewAction(state, { reason: 'trace', connected: true })).toBe(state);
    expect(applyViewAction(state, { reason: 'trace', path: 'not-an-array' })).toBe(state);
  });
});

describe('applyViewAction — filter (#409, cli#214)', () => {
  it('records explicit matched nodeIds when filter.query was given', () => {
    const state = applyViewAction(INITIAL_VIEW_ACTION_STATE, {
      reason: 'filter',
      filter: { query: 'budget' },
      nodes: ['a', 'b'],
    });
    expect(state.filter).toEqual({ nodeIds: ['a', 'b'], query: 'budget', cluster: undefined, nodeType: undefined });
  });

  it('records nodeIds: null for a cluster/nodeType-only filter (server has no seam without a query)', () => {
    const state = applyViewAction(INITIAL_VIEW_ACTION_STATE, {
      reason: 'filter',
      filter: { cluster: 'engineering' },
      nodes: null,
    });
    expect(state.filter).toEqual({
      nodeIds: null,
      query: undefined,
      cluster: 'engineering',
      nodeType: undefined,
    });
  });

  it('a later filter REPLACES the prior one', () => {
    let state = applyViewAction(INITIAL_VIEW_ACTION_STATE, {
      reason: 'filter',
      filter: { query: 'a' },
      nodes: ['a'],
    });
    state = applyViewAction(state, { reason: 'filter', filter: { query: 'b' }, nodes: ['b'] });
    expect(state.filter?.nodeIds).toEqual(['b']);
  });

  it('is a no-op for a malformed filter payload (nodes neither null nor a string array)', () => {
    const state = INITIAL_VIEW_ACTION_STATE;
    expect(applyViewAction(state, { reason: 'filter', filter: {}, nodes: 'nope' })).toBe(state);
    expect(applyViewAction(state, { reason: 'filter', filter: {}, nodes: [1, 2] })).toBe(state);
  });
});

describe('applyViewAction — degrade paths (#409)', () => {
  it('is a no-op for a reason-less payload (the legacy content-patch shape)', () => {
    const state = INITIAL_VIEW_ACTION_STATE;
    expect(applyViewAction(state, { nodes: [{ id: 'a', title: 'x' }] })).toBe(state);
  });

  it('is a no-op for an unrecognized reason', () => {
    const state = INITIAL_VIEW_ACTION_STATE;
    expect(applyViewAction(state, { reason: 'something-else' })).toBe(state);
  });

  it('never throws for non-object payloads', () => {
    const state = INITIAL_VIEW_ACTION_STATE;
    expect(applyViewAction(state, undefined)).toBe(state);
    expect(applyViewAction(state, null)).toBe(state);
    expect(applyViewAction(state, 'oops')).toBe(state);
    expect(applyViewAction(state, 42)).toBe(state);
  });
});

describe('resolveFilterNodeIds (#409, cli#214)', () => {
  const graph = graphWith([
    node({ id: 'a', cluster: 'eng', entityType: 'doc' }),
    node({ id: 'b', cluster: 'eng', entityType: 'issue' }),
    node({ id: 'c', cluster: 'design', entityType: 'doc' }),
  ]);

  it('returns undefined when no filter is active', () => {
    expect(resolveFilterNodeIds(undefined, graph)).toBeUndefined();
  });

  it('passes through explicit nodeIds unchanged (server already matched by query)', () => {
    const filter: ViewActionState['filter'] = { nodeIds: ['a', 'c'] };
    expect(resolveFilterNodeIds(filter, graph)).toEqual(new Set(['a', 'c']));
  });

  it('resolves cluster-only filter client-side when nodeIds is null', () => {
    const filter: ViewActionState['filter'] = { nodeIds: null, cluster: 'eng' };
    expect(resolveFilterNodeIds(filter, graph)).toEqual(new Set(['a', 'b']));
  });

  it('resolves nodeType-only filter client-side when nodeIds is null', () => {
    const filter: ViewActionState['filter'] = { nodeIds: null, nodeType: 'doc' };
    expect(resolveFilterNodeIds(filter, graph)).toEqual(new Set(['a', 'c']));
  });

  it('combines cluster AND nodeType when both are given', () => {
    const filter: ViewActionState['filter'] = { nodeIds: null, cluster: 'eng', nodeType: 'doc' };
    expect(resolveFilterNodeIds(filter, graph)).toEqual(new Set(['a']));
  });

  it('returns undefined for an empty/malformed filter (nodeIds null, no cluster/nodeType)', () => {
    const filter: ViewActionState['filter'] = { nodeIds: null };
    expect(resolveFilterNodeIds(filter, graph)).toBeUndefined();
  });

  it('returns an empty set (not undefined) when a client-side filter matches nothing', () => {
    const filter: ViewActionState['filter'] = { nodeIds: null, cluster: 'nonexistent' };
    expect(resolveFilterNodeIds(filter, graph)).toEqual(new Set());
  });
});
