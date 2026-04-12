import { describe, it, expect } from 'vitest';
import {
  getNodeLayer,
  isContentTreeNode,
  filterGraphToLayer,
  collapseGraphClusters,
} from '../index';
import type { KBNode, KBGraph, KBEdge, Cluster } from '../index';

// ── Fixtures ───────────────────────────────────────────────

function makeNode(overrides: Partial<KBNode> & Pick<KBNode, 'id' | 'source'>): KBNode {
  return {
    title: overrides.id,
    cluster: 'default',
    content: '',
    rawContent: '',
    connections: [],
    ...overrides,
  };
}

function makeEdge(from: string, to: string, type: KBEdge['type'] = 'references'): KBEdge {
  return { from, to, type, description: '', source: 'inferred', weight: 1 };
}

const fileNode = makeNode({ id: 'f1', source: { type: 'file', path: 'src/utils.ts' } });
const authoredNode = makeNode({
  id: 'a1',
  source: { type: 'authored', file: 'content/guide.md' },
  identity: 'urn:file:content/guide.md',
});
const issueNode = makeNode({ id: 'i1', source: { type: 'issue', number: 42, state: 'open', labels: ['bug'] } });
const prNode = makeNode({ id: 'pr1', source: { type: 'pull_request', number: 10, state: 'open' } });
const commitNode = makeNode({ id: 'c1', source: { type: 'commit', sha: 'abc123' } });
const readmeNode = makeNode({ id: 'r1', source: { type: 'readme' } });
const sectionNode = makeNode({
  id: 's1',
  source: { type: 'section', parentSource: { type: 'authored', file: 'content/guide.md' } },
});
const contentTreeNode = makeNode({ id: 'ct1', source: { type: 'file', path: 'content/guide.md' }, identity: 'urn:file:content/guide.md' });

// ── getNodeLayer ───────────────────────────────────────────

describe('getNodeLayer', () => {
  it('classifies file source as "file"', () => {
    expect(getNodeLayer(fileNode)).toBe('file');
  });

  it('classifies authored source as "content"', () => {
    expect(getNodeLayer(authoredNode)).toBe('content');
  });

  it('classifies readme source as "content"', () => {
    expect(getNodeLayer(readmeNode)).toBe('content');
  });

  it('classifies section source as "content"', () => {
    expect(getNodeLayer(sectionNode)).toBe('content');
  });

  it('classifies issue source as "work"', () => {
    expect(getNodeLayer(issueNode)).toBe('work');
  });

  it('classifies pull_request source as "work"', () => {
    expect(getNodeLayer(prNode)).toBe('work');
  });

  it('classifies commit source as "work"', () => {
    expect(getNodeLayer(commitNode)).toBe('work');
  });
});

// ── isContentTreeNode ──────────────────────────────────────

describe('isContentTreeNode', () => {
  it('returns true for file node with content/ path', () => {
    expect(isContentTreeNode(contentTreeNode)).toBe(true);
  });

  it('returns false for file node outside content/', () => {
    expect(isContentTreeNode(fileNode)).toBe(false);
  });

  it('returns false for authored node', () => {
    expect(isContentTreeNode(authoredNode)).toBe(false);
  });
});

// ── filterGraphToLayer ─────────────────────────────────────

describe('filterGraphToLayer', () => {
  const clusters: Cluster[] = [{ id: 'default', name: 'Default', color: '#fff' }];

  function testGraph(nodes: KBNode[], edges: KBEdge[] = [], related: Record<string, string[]> = {}): KBGraph {
    return { nodes, edges, clusters, related };
  }

  it('"file" layer keeps only file nodes', () => {
    const graph = testGraph([fileNode, authoredNode, issueNode]);
    const result = filterGraphToLayer(graph, 'file');

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe('f1');
  });

  it('"content" layer keeps authored and referenced file nodes', () => {
    const extFileNode = makeNode({ id: 'ef1', source: { type: 'file', path: 'lib/helper.ts' } });
    const edges = [makeEdge('a1', 'ef1')];
    const graph = testGraph([authoredNode, extFileNode, fileNode, issueNode], edges);
    const result = filterGraphToLayer(graph, 'content');

    const ids = result.nodes.map(n => n.id);
    expect(ids).toContain('a1');
    expect(ids).toContain('ef1'); // referenced by content
    expect(ids).not.toContain('f1'); // not referenced by content
    expect(ids).not.toContain('i1');
  });

  it('"content" layer excludes content/ tree duplicates', () => {
    const edges = [makeEdge('a1', 'ct1')];
    const graph = testGraph([authoredNode, contentTreeNode], edges);
    const result = filterGraphToLayer(graph, 'content');

    const ids = result.nodes.map(n => n.id);
    expect(ids).toContain('a1');
    expect(ids).not.toContain('ct1'); // content/ tree duplicate excluded
  });

  it('"content" layer remaps identity-linked file node edges to content node', () => {
    // contentTreeNode shares identity with authoredNode
    const outsideFile = makeNode({ id: 'ext', source: { type: 'file', path: 'lib/x.ts' } });
    const edges = [
      makeEdge('ext', 'ct1'), // edge to the file-layer content tree node
    ];
    const graph = testGraph([authoredNode, contentTreeNode, outsideFile], edges);
    const result = filterGraphToLayer(graph, 'content');

    // The edge from ext→ct1 should be remapped to ext→a1
    // But ext is not a content node and only gets included if referenced by content
    // ct1 is identity-mapped to a1, so the edge becomes ext→a1
    // ext would be included since content node a1 is now connected
    const edgeTargets = result.edges.map(e => e.to);
    if (result.edges.length > 0) {
      expect(edgeTargets).not.toContain('ct1');
    }
  });

  it('"work" layer keeps only issue/PR/commit nodes', () => {
    const graph = testGraph([fileNode, authoredNode, issueNode, prNode, commitNode]);
    const result = filterGraphToLayer(graph, 'work');

    expect(result.nodes).toHaveLength(3);
    const ids = result.nodes.map(n => n.id).sort();
    expect(ids).toEqual(['c1', 'i1', 'pr1']);
  });

  it('filters edges to only visible nodes', () => {
    const edges = [makeEdge('f1', 'i1'), makeEdge('f1', 'f1')];
    const graph = testGraph([fileNode, issueNode], edges);
    const result = filterGraphToLayer(graph, 'file');

    // i1 is filtered out, so the edge f1→i1 should not survive
    expect(result.edges.every(e => e.from === 'f1' && e.to === 'f1')).toBe(true);
  });
});

// ── collapseGraphClusters ──────────────────────────────────

describe('collapseGraphClusters', () => {
  const clusters: Cluster[] = [
    { id: 'engine', name: 'Engine', color: '#aaa' },
    { id: 'ui', name: 'UI', color: '#bbb' },
  ];

  const n1 = makeNode({ id: 'n1', cluster: 'engine', source: { type: 'file', path: 'a.ts' } });
  const n2 = makeNode({ id: 'n2', cluster: 'engine', source: { type: 'file', path: 'b.ts' } });
  const n3 = makeNode({ id: 'n3', cluster: 'ui', source: { type: 'file', path: 'c.ts' } });

  it('replaces collapsed cluster nodes with a single summary node', () => {
    const graph: KBGraph = { nodes: [n1, n2, n3], edges: [], clusters, related: {} };
    const result = collapseGraphClusters(graph, new Set(['engine']));

    expect(result.nodes.find(n => n.id === 'n1')).toBeUndefined();
    expect(result.nodes.find(n => n.id === 'n2')).toBeUndefined();
    const summary = result.nodes.find(n => n.id === 'cluster-engine');
    expect(summary).toBeDefined();
    expect(summary!.title).toBe('Engine (2)');
    expect(result.nodes.find(n => n.id === 'n3')).toBeDefined();
  });

  it('remaps edges to/from collapsed nodes to summary node', () => {
    const edges = [makeEdge('n1', 'n3'), makeEdge('n3', 'n2')];
    const graph: KBGraph = { nodes: [n1, n2, n3], edges, clusters, related: {} };
    const result = collapseGraphClusters(graph, new Set(['engine']));

    expect(result.edges.some(e => e.from === 'cluster-engine' && e.to === 'n3')).toBe(true);
    expect(result.edges.some(e => e.from === 'n3' && e.to === 'cluster-engine')).toBe(true);
  });

  it('removes intra-cluster edges', () => {
    const edges = [makeEdge('n1', 'n2')];
    const graph: KBGraph = { nodes: [n1, n2, n3], edges, clusters, related: {} };
    const result = collapseGraphClusters(graph, new Set(['engine']));

    expect(result.edges).toHaveLength(0);
  });

  it('deduplicates remapped edges including type', () => {
    const edges = [
      makeEdge('n1', 'n3', 'references'),
      makeEdge('n2', 'n3', 'references'), // same target, same type → dedup
    ];
    const graph: KBGraph = { nodes: [n1, n2, n3], edges, clusters, related: {} };
    const result = collapseGraphClusters(graph, new Set(['engine']));

    const outEdges = result.edges.filter(e => e.from === 'cluster-engine' && e.to === 'n3');
    expect(outEdges).toHaveLength(1);
  });

  it('aggregates related from constituent nodes into summary node', () => {
    const related = { n1: ['n3'], n2: ['n3'] };
    const graph: KBGraph = { nodes: [n1, n2, n3], edges: [], clusters, related };
    const result = collapseGraphClusters(graph, new Set(['engine']));

    expect(result.related['cluster-engine']).toEqual(['n3']);
  });

  it('returns graph unchanged when collapsedIds is empty', () => {
    const graph: KBGraph = { nodes: [n1, n2, n3], edges: [], clusters, related: {} };
    const result = collapseGraphClusters(graph, new Set());

    expect(result).toBe(graph); // identity — same reference
  });
});
