import { describe, expect, it, vi } from 'vitest';
import {
  applyGraphUpdatedEvent,
  resolveEventsUrl,
  subscribeToCanvasEvents,
  type CanvasEventSourceLike,
} from '../useCanvasEvents';
import type { KBGraph, KBNode } from '../../types';

/**
 * Agent action surface (#409). Pure-function tests only — no DOM/EventSource
 * required, matching the repo's existing pattern for canvas hooks (see
 * `useCanvasTheme.test.ts`, which tests `resolveCanvasTheme` rather than the
 * hook itself).
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

describe('resolveEventsUrl (#409)', () => {
  it('defaults to the relative /events path with no searchServiceUrl', () => {
    expect(resolveEventsUrl({})).toBe('/events');
  });

  it('derives the events URL from searchServiceUrl\'s origin', () => {
    expect(resolveEventsUrl({ searchServiceUrl: 'http://127.0.0.1:54321/search' })).toBe(
      'http://127.0.0.1:54321/events',
    );
  });

  it('falls back to the relative path when searchServiceUrl is malformed', () => {
    expect(resolveEventsUrl({ searchServiceUrl: 'not a url' })).toBe('/events');
  });
});

describe('applyGraphUpdatedEvent (#409)', () => {
  it('patches fields onto an existing node by id', () => {
    const graph = graphWith([node({ id: 'readme', title: 'Old title' })]);
    const next = applyGraphUpdatedEvent(graph, {
      nodes: [{ id: 'readme', title: 'New title from SSE' }],
    });
    expect(next).not.toBe(graph);
    expect(next.nodes[0].title).toBe('New title from SSE');
    expect(next.nodes[0].id).toBe('readme'); // id is never overwritten
  });

  it('leaves nodes not mentioned in the payload untouched', () => {
    const graph = graphWith([node({ id: 'a', title: 'A' }), node({ id: 'b', title: 'B' })]);
    const next = applyGraphUpdatedEvent(graph, { nodes: [{ id: 'a', title: 'A2' }] });
    expect(next.nodes.find(n => n.id === 'a')?.title).toBe('A2');
    expect(next.nodes.find(n => n.id === 'b')?.title).toBe('B');
  });

  it('ignores patches for ids not present in the graph (no new-node fabrication)', () => {
    const graph = graphWith([node({ id: 'readme' })]);
    const next = applyGraphUpdatedEvent(graph, {
      nodes: [{ id: 'brand-new-node', title: 'Should not appear' }],
    });
    expect(next).toBe(graph); // referentially unchanged — a clean no-op
    expect(next.nodes).toHaveLength(1);
  });

  it('is a no-op for a malformed payload (missing/non-array nodes)', () => {
    const graph = graphWith([node({ id: 'readme' })]);
    expect(applyGraphUpdatedEvent(graph, {})).toBe(graph);
    expect(applyGraphUpdatedEvent(graph, { nodes: 'not-an-array' })).toBe(graph);
    expect(applyGraphUpdatedEvent(graph, undefined)).toBe(graph);
    expect(applyGraphUpdatedEvent(graph, null)).toBe(graph);
  });

  it('ignores individual entries without a valid string id', () => {
    const graph = graphWith([node({ id: 'readme', title: 'Old' })]);
    const next = applyGraphUpdatedEvent(graph, {
      nodes: [{ title: 'no id here' }, { id: 123 }, { id: '' }],
    });
    expect(next).toBe(graph);
  });
});

/** A fake EventSource capturing registered listeners for direct dispatch. */
function fakeEventSource(): {
  source: CanvasEventSourceLike;
  dispatch: (type: string, data: unknown) => void;
  close: ReturnType<typeof vi.fn>;
} {
  const listeners = new Map<string, (event: { data: string }) => void>();
  const close = vi.fn();
  const source: CanvasEventSourceLike = {
    addEventListener: (type, listener) => listeners.set(type, listener),
    close,
    onerror: null,
  };
  return {
    source,
    close,
    dispatch: (type, data) => listeners.get(type)?.({ data: JSON.stringify(data) }),
  };
}

describe('subscribeToCanvasEvents (#409)', () => {
  it('invokes onAnchor with the parsed nodeId when an anchor event arrives', () => {
    const { source, dispatch } = fakeEventSource();
    const onAnchor = vi.fn();
    subscribeToCanvasEvents('/events', { onAnchor }, () => source);
    dispatch('anchor', { nodeId: 'q1-uplift' });
    expect(onAnchor).toHaveBeenCalledWith('q1-uplift');
  });

  it('invokes onGraphUpdated with the parsed payload when a graph-updated event arrives', () => {
    const { source, dispatch } = fakeEventSource();
    const onGraphUpdated = vi.fn();
    subscribeToCanvasEvents('/events', { onGraphUpdated }, () => source);
    dispatch('graph-updated', { nodes: [{ id: 'readme', title: 'x' }] });
    expect(onGraphUpdated).toHaveBeenCalledWith({ nodes: [{ id: 'readme', title: 'x' }] });
  });

  it('ignores an anchor event with no nodeId (defensive — never throws)', () => {
    const { source, dispatch } = fakeEventSource();
    const onAnchor = vi.fn();
    subscribeToCanvasEvents('/events', { onAnchor }, () => source);
    expect(() => dispatch('anchor', {})).not.toThrow();
    expect(onAnchor).not.toHaveBeenCalled();
  });

  it('routes transport errors to onError without throwing', () => {
    const { source } = fakeEventSource();
    const onError = vi.fn();
    subscribeToCanvasEvents('/events', { onError }, () => source);
    source.onerror?.({ type: 'error' });
    expect(onError).toHaveBeenCalledWith({ type: 'error' });
  });

  it('degrades safely with no handlers at all', () => {
    const { source, dispatch } = fakeEventSource();
    subscribeToCanvasEvents('/events', {}, () => source);
    expect(() => {
      dispatch('anchor', { nodeId: 'x' });
      dispatch('graph-updated', { nodes: [] });
      source.onerror?.({ type: 'error' });
    }).not.toThrow();
  });

  it('closes the underlying source when the cleanup function runs', () => {
    const { source, close } = fakeEventSource();
    const cleanup = subscribeToCanvasEvents('/events', {}, () => source);
    expect(close).not.toHaveBeenCalled();
    cleanup();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
