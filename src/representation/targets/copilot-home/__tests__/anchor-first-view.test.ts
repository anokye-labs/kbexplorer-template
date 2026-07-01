import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { KBConfig, KBGraph, KBNode } from '../../../../types';
import { expandAnchoredNeighborhood } from '../../llm-context';
import { AnchorFirstView } from '../AnchorFirstView';

function node(id: string): KBNode {
  return {
    id,
    title: `Title ${id}`,
    cluster: 'default',
    content: '',
    rawContent: `Body of ${id}`,
    connections: [],
    source: { type: 'file', path: '' },
  };
}

// anchor -> n1 (weight 5), n2 (weight 3); related is weight-ranked.
const graph: KBGraph = {
  nodes: [node('anchor'), node('n1'), node('n2'), node('far')],
  edges: [
    { from: 'anchor', to: 'n1', type: 'references', relation: 'leads', description: '', source: 'inline', weight: 5 },
    { from: 'anchor', to: 'n2', type: 'references', relation: 'staffs', description: '', source: 'inline', weight: 3 },
  ],
  clusters: [],
  related: { anchor: ['n1', 'n2'], n1: ['anchor'], n2: ['anchor'] },
};

const config = {
  clusters: { default: { name: 'Default', color: '#4A9CC8' } },
} as unknown as KBConfig;

describe('expandAnchoredNeighborhood (shared #408 / llm-context ranking)', () => {
  it('walks graph.related in weight rank order into ranked candidates', () => {
    const { expanded } = expandAnchoredNeighborhood(graph, ['anchor'], () => 1, 10);
    expect(expanded.map(n => n.node.id)).toEqual(['n1', 'n2']);
    // best-anchor edge is carried for relation/weight labelling
    expect(expanded[0].edge?.relation).toBe('leads');
  });

  it('greedily partitions expanded vs unexpanded by the count budget', () => {
    const { expanded, unexpanded } = expandAnchoredNeighborhood(graph, ['anchor'], () => 1, 1);
    expect(expanded.map(n => n.node.id)).toEqual(['n1']);
    expect(unexpanded.map(n => n.node.id)).toEqual(['n2']);
  });

  it('never expands the whole graph — only the anchor neighborhood', () => {
    const { expanded, unexpanded } = expandAnchoredNeighborhood(graph, ['anchor'], () => 1, 10);
    const ids = [...expanded, ...unexpanded].map(n => n.node.id);
    expect(ids).not.toContain('far'); // two hops away
    expect(ids).not.toContain('anchor'); // anchors are excluded from neighbors
  });

  it('degrades gracefully (no throw) for an absent anchor id', () => {
    const { anchors, expanded } = expandAnchoredNeighborhood(graph, ['nope'], () => 1, 10);
    expect(anchors).toEqual([]);
    expect(expanded).toEqual([]);
  });
});

describe('AnchorFirstView (B2 #408 landing)', () => {
  it('renders the anchor + expanded neighbor + kg:// chip navigation', () => {
    const html = renderToStaticMarkup(
      createElement(AnchorFirstView, { graph, config, anchorId: 'anchor', maxExpanded: 1 }),
    );
    // anchor is featured
    expect(html).toContain('data-testid="anchor-first-view"');
    expect(html).toContain('Title anchor');
    // top-ranked neighbor expanded inline...
    expect(html).toContain('data-testid="anchor-expanded-neighbor"');
    expect(html).toContain('data-node-id="n1"');
    // ...the rest are navigable kg:// chips that re-anchor the view
    expect(html).toContain('data-testid="anchor-neighbor-chip"');
    expect(html).toContain('href="#/node/n2"');
    // constellation is an optional zoom-out affordance, not the landing
    expect(html).toContain('data-testid="constellation-zoom-out"');
    expect(html).toContain('href="#/constellation"');
  });

  it('links the anchor URN and clicking a neighbor card re-anchors', () => {
    const html = renderToStaticMarkup(
      createElement(AnchorFirstView, { graph, config, anchorId: 'anchor', maxExpanded: 6 }),
    );
    expect(html).toContain('href="#/node/n1"');
    expect(html).toContain('href="#/node/n2"');
    // no chips when every neighbor fits the expansion budget
    expect(html).not.toContain('data-testid="anchor-neighbor-chip"');
  });
});
