import { describe, it, expect, afterEach } from 'vitest';
import { isDemoEntitiesEnabled, injectDemoEntities, isRichMarkdownDemoEnabled, injectRichMarkdownDemo } from '../demo-entities';
import { resetNodeTypeRegistry } from '../node-types';
import { getEdgeStyle } from '../../types';
import { getRichMarkdownDocument } from '../../views/rich-markdown/types';
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

  it('appends person/squad/team/charter entity nodes without mutating the original graph', () => {
    const graph = baseGraph();
    const originalNodeCount = graph.nodes.length;
    const result = injectDemoEntities(graph);

    expect(graph.nodes).toHaveLength(originalNodeCount); // original untouched
    expect(result.nodes.length).toBe(originalNodeCount + 5);

    const ids = result.nodes.map(n => n.id);
    expect(ids).toContain('demo-team-atlas');
    expect(ids).toContain('demo-squad-orbit');
    expect(ids).toContain('demo-person-ada');
    expect(ids).toContain('demo-person-ben');
    expect(ids).toContain('demo-charter-atlas');
  });

  it('renders the squad through the squad entity type + SquadView data shape', () => {
    const result = injectDemoEntities(baseGraph());
    const squad = result.nodes.find(n => n.id === 'demo-squad-orbit')!;
    expect(squad.display).toBe('entity');
    expect(squad.entityType).toBe('squad');
    expect(squad.source.type).toBe('structured');
    expect(squad.jsonld?.['@id']).toBe(squad.identity);
    expect(squad.data?.dri).toBe('ada');
    expect(squad.data?.members).toEqual(['Ada Okonkwo', 'Ben Carter']);
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

  it('is collision-safe: returns the graph unchanged if a demo id already exists', () => {
    const graph = baseGraph();
    graph.nodes.push(makeNode('demo-person-ada', { entityType: 'person' }));
    const before = graph.nodes.length;
    const result = injectDemoEntities(graph);
    // no duplicate ids appended; graph returned unchanged
    expect(result.nodes).toHaveLength(before);
    expect(result.nodes.filter(n => n.id === 'demo-person-ada')).toHaveLength(1);
  });

  it('double-injection is idempotent (no duplicate demo nodes)', () => {
    const once = injectDemoEntities(baseGraph());
    const twice = injectDemoEntities(once);
    expect(twice.nodes.filter(n => n.id === 'demo-person-ben')).toHaveLength(1);
    expect(twice.nodes).toHaveLength(once.nodes.length);
  });
});

describe('rich-Markdown demo seam (#427)', () => {
  it('is disabled by default (no window in node env)', () => {
    expect(isRichMarkdownDemoEnabled()).toBe(false);
  });

  it('appends the sample rich-Markdown doc, anchored to the hub, without mutating the original', () => {
    const graph = baseGraph();
    const before = graph.nodes.length;
    const result = injectRichMarkdownDemo(graph);

    expect(graph.nodes).toHaveLength(before); // original untouched
    expect(result.nodes).toHaveLength(before + 1);

    const doc = result.nodes.find(n => n.id === 'demo-richmd-doc')!;
    expect(doc.display).toBe('rich-markdown');
    expect(result.edges.some(e => e.from === 'readme' && e.to === 'demo-richmd-doc')).toBe(true);
    expect(result.clusters.filter(c => c.id === 'docs')).toHaveLength(1);
  });

  it('carries a valid rich-Markdown payload (mermaid + dot/ics/canvas blocks)', () => {
    const result = injectRichMarkdownDemo(baseGraph());
    const node = result.nodes.find(n => n.id === 'demo-richmd-doc')!;
    const richMarkdown = getRichMarkdownDocument(node);
    expect(richMarkdown).not.toBeNull();
    expect(richMarkdown!.blocks.map(b => b.kind)).toEqual(['mermaid', 'dot', 'ics', 'canvas']);
    // every non-mermaid block ships a pre-built SVG (so none degrades to raw code)
    for (const b of richMarkdown!.blocks.filter(b => b.kind !== 'mermaid')) {
      expect(typeof b.svg).toBe('string');
    }
    // content is rendered HTML carrying the fenced blocks the prose walk upgrades
    expect(node.content).toContain('language-dot');
    expect(node.content).toContain('language-canvas');
  });

  it('is idempotent (no duplicate demo doc)', () => {
    const once = injectRichMarkdownDemo(baseGraph());
    const twice = injectRichMarkdownDemo(once);
    expect(twice.nodes.filter(n => n.id === 'demo-richmd-doc')).toHaveLength(1);
    expect(twice.nodes).toHaveLength(once.nodes.length);
  });
});
