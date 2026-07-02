import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { KBConfig, KBEdge, KBGraph, KBNode } from '../../../../types';
import { ConstellationView } from '../ConstellationView';

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

const CONFIG = { title: 'Test Repo', clusters: {} } as unknown as KBConfig;

describe('ConstellationView (#453 static chrome)', () => {
  it('renders a back affordance, live node/edge counts, and the full-viewport canvas container', () => {
    const graph = graphWith(172, 640);
    const html = renderToStaticMarkup(
      createElement(MemoryRouter, null, createElement(ConstellationView, { graph, config: CONFIG })),
    );

    expect(html).toContain('data-testid="constellation-view"');
    expect(html).toContain('data-testid="constellation-canvas"');
    expect(html).toContain('data-testid="constellation-stats"');
    // Back affordance re-anchors to the copilot target's own root redirect
    // (`/` → the conversation anchor or configured landing path).
    expect(html).toContain('href="#/"');
    // Live counts sourced from the graph, not a hardcoded placeholder.
    expect(html).toContain('172 nodes');
    expect(html).toContain('640 links');
  });

  it('reflects the actual graph size in the stats text, not a fixed/stale count', () => {
    const html = renderToStaticMarkup(
      createElement(MemoryRouter, null, createElement(ConstellationView, { graph: graphWith(5, 3), config: CONFIG })),
    );
    expect(html).toContain('5 nodes');
    expect(html).toContain('3 links');
  });
});
