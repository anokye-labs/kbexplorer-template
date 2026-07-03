import { describe, it, expect } from 'vitest';
import { trimGraphToLimits } from '../index';
import type { KBNode, KBGraph } from '../index';

// ── Helpers ────────────────────────────────────────────────
// Ported from the deleted `src/engine/__tests__/graph.test.ts`
// `describe('trimGraphToLimits', ...)` block (slice-1 shim swap, #472):
// `trimGraphToLimits` is NOT part of the engine migration — it stays
// implemented locally in `../index` and is actively used from
// `src/components/HUD.tsx` in the live render path, so its coverage
// belongs here rather than in the engine package.

function makeNode(id: string, overrides: Partial<KBNode> = {}): KBNode {
  return {
    id,
    title: id,
    cluster: 'default',
    content: '',
    rawContent: '',
    connections: [],
    source: { type: 'authored', file: `content/${id}.md` },
    ...overrides,
  };
}

function makeLargeGraph(nodeCount: number): KBGraph {
  const nodes = Array.from({ length: nodeCount }, (_, i) =>
    makeNode(`n${i}`, { cluster: `c${i % 3}` })
  );
  // Hub node
  nodes.push(makeNode('readme', { cluster: 'c0' }));
  // Connect every node to readme
  const edges = nodes.filter(n => n.id !== 'readme').map(n => ({
    from: 'readme', to: n.id, type: 'references' as const,
    description: '', source: 'frontmatter' as const, weight: 2,
  }));
  const related: Record<string, string[]> = {
    readme: nodes.filter(n => n.id !== 'readme').map(n => n.id),
  };
  return {
    nodes,
    edges,
    clusters: [
      { id: 'c0', name: 'C0', color: '#f00' },
      { id: 'c1', name: 'C1', color: '#0f0' },
      { id: 'c2', name: 'C2', color: '#00f' },
    ],
    related,
  };
}

describe('trimGraphToLimits', () => {
  it('returns graph unchanged when under limits', () => {
    const graph = makeLargeGraph(10);
    const result = trimGraphToLimits(graph, null, 50, 100);
    expect(result.trimmed).toBe(false);
    expect(result.graph.nodes.length).toBe(graph.nodes.length);
  });

  it('caps nodes at maxNodes', () => {
    const graph = makeLargeGraph(80);
    const result = trimGraphToLimits(graph, null, 20, 100);
    expect(result.trimmed).toBe(true);
    expect(result.graph.nodes.length).toBeLessThanOrEqual(20);
    expect(result.totalNodes).toBe(81); // 80 + readme
  });

  it('always keeps hub node (readme)', () => {
    const graph = makeLargeGraph(80);
    const result = trimGraphToLimits(graph, null, 20, 100);
    expect(result.graph.nodes.some(n => n.id === 'readme')).toBe(true);
  });

  it('always keeps current node', () => {
    const graph = makeLargeGraph(80);
    const result = trimGraphToLimits(graph, 'n75', 20, 100);
    expect(result.graph.nodes.some(n => n.id === 'n75')).toBe(true);
  });

  it('keeps all edges between visible nodes (no edge cap)', () => {
    const graph = makeLargeGraph(80);
    const result = trimGraphToLimits(graph, null, 20, Infinity);
    // All edges between kept nodes should be present
    const keptIds = new Set(result.graph.nodes.map(n => n.id));
    const expectedEdges = graph.edges.filter(e => keptIds.has(e.from) && keptIds.has(e.to));
    expect(result.graph.edges.length).toBe(expectedEdges.length);
  });

  it('maintains at least 1 node per cluster', () => {
    const graph = makeLargeGraph(80);
    const result = trimGraphToLimits(graph, null, 20, 100);
    const clusterIds = new Set(result.graph.nodes.map(n => n.cluster));
    // All 3 clusters should be represented
    expect(clusterIds.has('c0')).toBe(true);
    expect(clusterIds.has('c1')).toBe(true);
    expect(clusterIds.has('c2')).toBe(true);
  });

  it('rebuilds related map for trimmed nodes only', () => {
    const graph = makeLargeGraph(80);
    const result = trimGraphToLimits(graph, null, 20, 100);
    const nodeIds = new Set(result.graph.nodes.map(n => n.id));
    for (const [, related] of Object.entries(result.graph.related)) {
      for (const rid of related) {
        expect(nodeIds.has(rid)).toBe(true);
      }
    }
  });
});
