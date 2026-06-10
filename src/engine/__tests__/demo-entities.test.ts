import { describe, it, expect, afterEach } from 'vitest';
import { isDemoEntitiesEnabled, injectDemoEntities } from '../demo-entities';
import { resetNodeTypeRegistry } from '../node-types';
import { getEdgeStyle } from '../../types';
import type { KBGraph, KBNode } from '../../types';

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

function baseGraph(): KBGraph {
  return {
    nodes: [makeNode('readme', { source: { type: 'readme' } })],
    edges: [],
    clusters: [{ id: 'default', name: 'Default', color: '#ccc' }],
    related: {},
  };
}

afterEach(() => {
  resetNodeTypeRegistry();
});

describe('demo-entities seam', () => {
  it('is disabled by default (no window in node env)', () => {
    expect(isDemoEntitiesEnabled()).toBe(false);
  });

  it('appends person/team entity nodes without mutating the original graph', () => {
    const graph = baseGraph();
    const originalNodeCount = graph.nodes.length;
    const result = injectDemoEntities(graph);

    expect(graph.nodes).toHaveLength(originalNodeCount); // original untouched
    expect(result.nodes.length).toBe(originalNodeCount + 3);

    const ids = result.nodes.map(n => n.id);
    expect(ids).toContain('demo-team-atlas');
    expect(ids).toContain('demo-person-ada');
    expect(ids).toContain('demo-person-ben');
  });

  it('marks entity nodes with display=entity, structured source, jsonld and data', () => {
    const result = injectDemoEntities(baseGraph());
    const ada = result.nodes.find(n => n.id === 'demo-person-ada')!;
    expect(ada.display).toBe('entity');
    expect(ada.entityType).toBe('person');
    expect(ada.source.type).toBe('structured');
    expect(ada.jsonld?.['@type']).toBe('Person');
    expect(ada.jsonld?.['@id']).toBe(ada.identity);
    expect(ada.data?.role).toBe('Engineering Lead');
  });

  it('wires the relation taxonomy (leads/staffs/reports-to) and anchors to the hub', () => {
    const result = injectDemoEntities(baseGraph());
    const relations = result.edges.map(e => e.relation).filter(Boolean);
    expect(relations).toContain('leads');
    expect(relations).toContain('staffs');
    expect(relations).toContain('reports-to');
    expect(relations).toContain('structural'); // hub anchor

    // every relation edge resolves to a concrete style
    for (const e of result.edges) {
      if (e.relation) expect(getEdgeStyle(e).color).toBeTruthy();
    }

    // anchored to readme hub
    expect(result.edges.some(e => e.from === 'readme' && e.to === 'demo-team-atlas')).toBe(true);
  });

  it('adds an "org" cluster exactly once', () => {
    const result = injectDemoEntities(baseGraph());
    expect(result.clusters.filter(c => c.id === 'org')).toHaveLength(1);
  });
});
