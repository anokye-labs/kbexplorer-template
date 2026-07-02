import { describe, it, expect, vi } from 'vitest';
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

describe('AnchorFirstView — agent view-actions (#409, cli#214)', () => {
  it('expand force-promotes an over-budget neighbor from chips into expanded cards', () => {
    // maxExpanded: 1 -> n1 expanded, n2 relegated to a chip by rank alone.
    const html = renderToStaticMarkup(
      createElement(AnchorFirstView, {
        graph,
        config,
        anchorId: 'anchor',
        maxExpanded: 1,
        viewAction: { expandedNodeIds: new Set(['n2']) },
      }),
    );
    // n2 is now an expanded card, not a chip.
    expect(html).toMatch(/data-testid="anchor-expanded-neighbor"[^>]*data-node-id="n2"/);
    expect(html).not.toMatch(/data-testid="anchor-neighbor-chip"[^>]*data-node-id="n2"/);
  });

  it('expand synthesizes a card for a node outside the ranked neighborhood entirely', () => {
    // 'far' is two hops away — not in graph.related['anchor'] at all.
    const html = renderToStaticMarkup(
      createElement(AnchorFirstView, {
        graph,
        config,
        anchorId: 'anchor',
        maxExpanded: 6,
        viewAction: { expandedNodeIds: new Set(['far']) },
      }),
    );
    expect(html).toMatch(/data-testid="anchor-expanded-neighbor"[^>]*data-node-id="far"/);
  });

  it('expand degrades silently for an unknown node id (no fabrication)', () => {
    expect(() =>
      renderToStaticMarkup(
        createElement(AnchorFirstView, {
          graph,
          config,
          anchorId: 'anchor',
          maxExpanded: 6,
          viewAction: { expandedNodeIds: new Set(['does-not-exist']) },
        }),
      ),
    ).not.toThrow();
  });

  it('expand skips an unknown id (with a dev warning) while still rendering the known ids in the same batch', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const html = renderToStaticMarkup(
        createElement(AnchorFirstView, {
          graph,
          config,
          anchorId: 'anchor',
          maxExpanded: 6,
          // 'far' is a real node id; 'does-not-exist' is not in `graph` at all
          // (the kbexplorer-cli#216 server<->client id-space seam) — the known
          // id must still render even though the batch also names an unknown one.
          viewAction: { expandedNodeIds: new Set(['far', 'does-not-exist']) },
        }),
      );
      expect(html).toMatch(/data-testid="anchor-expanded-neighbor"[^>]*data-node-id="far"/);
      expect(html).not.toContain('does-not-exist');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('"does-not-exist" not found in the loaded manifest'),
      );
    } finally {
      warn.mockRestore();
    }
  });

  it('focus marks the matching neighbor card with data-kbx-focused', () => {
    const html = renderToStaticMarkup(
      createElement(AnchorFirstView, {
        graph,
        config,
        anchorId: 'anchor',
        maxExpanded: 6,
        viewAction: { focusNodeId: 'n1' },
      }),
    );
    expect(html).toMatch(/data-node-id="n1"[^>]*data-kbx-focused="true"/);
    expect(html).not.toMatch(/data-node-id="n2"[^>]*data-kbx-focused="true"/);
  });

  it('focus marks the anchor itself when focusNodeId is the anchor', () => {
    const html = renderToStaticMarkup(
      createElement(AnchorFirstView, {
        graph,
        config,
        anchorId: 'anchor',
        viewAction: { focusNodeId: 'anchor' },
      }),
    );
    expect(html).toMatch(/data-testid="anchor-first-view"[^>]*data-kbx-focused="true"/);
  });

  it('trace renders a path banner with a connected indicator and node titles', () => {
    const html = renderToStaticMarkup(
      createElement(AnchorFirstView, {
        graph,
        config,
        anchorId: 'anchor',
        maxExpanded: 6,
        viewAction: { trace: { path: ['anchor', 'n1'], connected: true } },
      }),
    );
    expect(html).toContain('data-testid="anchor-trace-banner"');
    expect(html).toContain('data-connected="true"');
    expect(html).toContain('Title n1');
  });

  it('trace renders a disconnected indicator when connected:false', () => {
    const html = renderToStaticMarkup(
      createElement(AnchorFirstView, {
        graph,
        config,
        anchorId: 'anchor',
        viewAction: { trace: { path: ['anchor', 'far'], connected: false } },
      }),
    );
    expect(html).toContain('data-connected="false"');
    expect(html).toContain('no path found');
  });

  it('trace falls back to the raw id (with a dev warning) for a path hop absent from the manifest', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const html = renderToStaticMarkup(
        createElement(AnchorFirstView, {
          graph,
          config,
          anchorId: 'anchor',
          // 'does-not-exist' is not in `graph` at all (kbexplorer-cli#216) —
          // the path still renders in full, with the raw id as that hop's label.
          viewAction: { trace: { path: ['anchor', 'does-not-exist'], connected: true } },
        }),
      );
      expect(html).toContain('data-testid="anchor-trace-banner"');
      expect(html).toMatch(/data-testid="anchor-trace-node"[^>]*data-node-id="does-not-exist"/);
      expect(html).toContain('does-not-exist');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('"does-not-exist" not found in the loaded manifest'),
      );
    } finally {
      warn.mockRestore();
    }
  });

  it('trace highlights a visible neighbor that sits on the path', () => {
    const html = renderToStaticMarkup(
      createElement(AnchorFirstView, {
        graph,
        config,
        anchorId: 'anchor',
        maxExpanded: 6,
        viewAction: { trace: { path: ['anchor', 'n1'], connected: true } },
      }),
    );
    expect(html).toMatch(/data-node-id="n1"[^>]*data-kbx-on-trace="true"/);
  });

  it('filter constrains rendered neighbors to the resolved id set', () => {
    const html = renderToStaticMarkup(
      createElement(AnchorFirstView, {
        graph,
        config,
        anchorId: 'anchor',
        maxExpanded: 6,
        viewAction: { filterNodeIds: new Set(['n1']) },
      }),
    );
    expect(html).toMatch(/data-testid="anchor-expanded-neighbor"[^>]*data-node-id="n1"/);
    expect(html).not.toContain('data-node-id="n2"');
    expect(html).toContain('data-testid="anchor-filter-hint"');
  });

  it('filter with no matches shows an explicit empty-result hint (not a blank/broken view)', () => {
    const html = renderToStaticMarkup(
      createElement(AnchorFirstView, {
        graph,
        config,
        anchorId: 'anchor',
        maxExpanded: 6,
        viewAction: { filterNodeIds: new Set<string>() },
      }),
    );
    expect(html).toContain('data-testid="anchor-filter-hint"');
    expect(html).toContain('no neighbors match');
    expect(html).not.toContain('data-testid="anchor-expanded-neighbor"');
    expect(html).not.toContain('data-testid="anchor-neighbor-chip"');
  });

  it('renders identically to the no-viewAction case when viewAction is omitted', () => {
    const withoutViewAction = renderToStaticMarkup(
      createElement(AnchorFirstView, { graph, config, anchorId: 'anchor', maxExpanded: 1 }),
    );
    const withEmptyViewAction = renderToStaticMarkup(
      createElement(AnchorFirstView, {
        graph,
        config,
        anchorId: 'anchor',
        maxExpanded: 1,
        viewAction: {},
      }),
    );
    expect(withEmptyViewAction).toBe(withoutViewAction);
  });
});
