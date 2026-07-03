import { describe, it, expect, vi } from 'vitest';
import type { KBEdge, KBGraph, KBNode } from '../../../../types';
import type { GraphNetworkResult } from '../../../graph-canvas/createGraphNetwork';
import { mountConstellationNetwork } from '../mountConstellationNetwork';

/** A small graph with `nodeCount` nodes wired into a cycle of `edgeCount` edges. */
function graphWith(nodeCount: number, edgeCount: number): KBGraph {
  const nodes: KBNode[] = Array.from({ length: nodeCount }, (_, i): KBNode => ({
    id: `n${i}`,
    title: `Node ${i}`,
    cluster: 'default',
    content: '',
    rawContent: '',
    connections: [],
    source: { type: 'file', path: '' },
  }));
  const edges: KBEdge[] = Array.from({ length: edgeCount }, (_, i): KBEdge => ({
    from: `n${i % Math.max(nodeCount, 1)}`,
    to: `n${(i + 1) % Math.max(nodeCount, 1)}`,
    type: 'references',
    relation: 'related',
    description: '',
    source: 'inline',
    weight: 1,
  }));
  return { nodes, edges, clusters: [], related: {} };
}

/** A fake `GraphNetworkResult` — `destroy` is a spy so cleanup is assertable. */
function fakeNetworkResult() {
  const destroy = vi.fn();
  const result: GraphNetworkResult = {
    network: { destroy } as unknown as GraphNetworkResult['network'],
    nodes: {} as GraphNetworkResult['nodes'],
    edges: {} as GraphNetworkResult['edges'],
    setEmphasis: vi.fn(),
  };
  return { result, destroy };
}

describe('mountConstellationNetwork (#453 — real interactive graph, not the decorative hero)', () => {
  it('calls createGraphNetwork with the container ref, the graph, isDark, interactive:true and fitOnStabilize:true', () => {
    const graph = graphWith(3, 2);
    const fakeContainer = { tagName: 'DIV' } as unknown as HTMLElement;
    const { result } = fakeNetworkResult();
    const createGraphNetworkFn = vi.fn().mockReturnValue(result);
    const navigate = vi.fn();

    mountConstellationNetwork(fakeContainer, graph, true, navigate, createGraphNetworkFn);

    expect(createGraphNetworkFn).toHaveBeenCalledTimes(1);
    const options = createGraphNetworkFn.mock.calls[0][0];
    // The exact container ref flows through untouched — not a copy/wrapper.
    expect(options.container).toBe(fakeContainer);
    expect(options.graph).toBe(graph);
    expect(options.isDark).toBe(true);
    expect(options.interactive).toBe(true);
    expect(options.fitOnStabilize).toBe(true);
    expect(options.auditSlot).toBe('copilotConstellation');
  });

  it('re-anchors the panel on node click: onNodeClick navigates to /node/<encoded id>', () => {
    const graph = graphWith(2, 1);
    const { result } = fakeNetworkResult();
    const createGraphNetworkFn = vi.fn().mockReturnValue(result);
    const navigate = vi.fn();

    mountConstellationNetwork({} as HTMLElement, graph, false, navigate, createGraphNetworkFn);

    const options = createGraphNetworkFn.mock.calls[0][0];
    expect(typeof options.onNodeClick).toBe('function');
    options.onNodeClick?.('kb://mission/x');
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/node/kb%3A%2F%2Fmission%2Fx');
  });

  it('destroys the network when the returned cleanup runs (unmount)', () => {
    const graph = graphWith(1, 0);
    const { result, destroy } = fakeNetworkResult();
    const createGraphNetworkFn = vi.fn().mockReturnValue(result);

    const cleanup = mountConstellationNetwork({} as HTMLElement, graph, true, vi.fn(), createGraphNetworkFn);
    expect(destroy).not.toHaveBeenCalled();

    cleanup();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('swallows an already-torn-down network error from destroy() without throwing', () => {
    const graph = graphWith(1, 0);
    const createGraphNetworkFn = vi.fn().mockReturnValue({
      network: {
        destroy: () => { throw new Error('already destroyed'); },
      } as unknown as GraphNetworkResult['network'],
      nodes: {} as GraphNetworkResult['nodes'],
      edges: {} as GraphNetworkResult['edges'],
      setEmphasis: vi.fn(),
    });

    const cleanup = mountConstellationNetwork({} as HTMLElement, graph, true, vi.fn(), createGraphNetworkFn);
    expect(() => cleanup()).not.toThrow();
  });
});
