import { describe, it, expect } from 'vitest';
import {
  buildJsonLd,
  getEdgeStyle,
  getEdgeLegendKey,
  getEdgeWeight,
  RELATION_STYLES,
  EDGE_TYPE_STYLES,
  EDGE_TYPE_WEIGHTS,
} from '../index';
import { getNodeLayer } from '../../representation/graph-layers';
import type { KBNode, DisplayMode, EdgeType, JsonLd } from '../index';

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

// ── T1.1 JSON-LD fields ────────────────────────────────────

describe('KBNode JSON-LD fields (T1.1)', () => {
  it('carries entityType, jsonld and data additively', () => {
    const node = makeNode({
      id: 'p1',
      source: { type: 'structured', entityType: 'person' },
      entityType: 'person',
      identity: 'kg://person/p1',
      jsonld: { '@id': 'kg://person/p1', '@type': 'Person', name: 'Ada' },
      data: { name: 'Ada', role: 'Lead' },
    });
    expect(node.entityType).toBe('person');
    expect(node.jsonld?.['@type']).toBe('Person');
    expect(node.data?.name).toBe('Ada');
  });

  it('buildJsonLd reuses identity as @id and merges data', () => {
    const ld: JsonLd = buildJsonLd(
      { id: 'p1', identity: 'kg://person/p1' },
      'Person',
      { name: 'Ada' },
    );
    expect(ld['@id']).toBe('kg://person/p1');
    expect(ld['@type']).toBe('Person');
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld.name).toBe('Ada');
  });

  it('buildJsonLd falls back to a kg:// node URN when identity is absent', () => {
    const ld = buildJsonLd({ id: 'x9' }, ['Person', 'Employee']);
    expect(ld['@id']).toBe('kg://node/x9');
    expect(ld['@type']).toEqual(['Person', 'Employee']);
  });

  it('buildJsonLd: data cannot override the reserved LD keys (@id/@type/@context)', () => {
    const ld = buildJsonLd(
      { id: 'p1', identity: 'kg://person/p1' },
      'Person',
      {
        '@id': 'kg://evil/override',
        '@type': 'Robot',
        '@context': 'https://evil.example',
        name: 'Ada',
      },
    );
    expect(ld['@id']).toBe('kg://person/p1');
    expect(ld['@type']).toBe('Person');
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld.name).toBe('Ada'); // non-reserved data still merges
  });

  it('a node without the new fields behaves exactly as before', () => {
    const node = makeNode({ id: 'f1', source: { type: 'file', path: 'a.ts' } });
    expect(node.entityType).toBeUndefined();
    expect(node.jsonld).toBeUndefined();
    expect(node.data).toBeUndefined();
    expect(getNodeLayer(node)).toBe('file');
  });
});

// ── T1.2 open unions ───────────────────────────────────────

describe('open DisplayMode / EdgeType (T1.2/T1.3)', () => {
  it('accepts both known and custom display modes (type-level)', () => {
    const known: DisplayMode = 'entity';
    const custom: DisplayMode = 'org-chart-3d';
    expect([known, custom]).toEqual(['entity', 'org-chart-3d']);
  });

  it('accepts both known and custom edge types (type-level)', () => {
    const known: EdgeType = 'contains';
    const custom: EdgeType = 'collaborates-with';
    expect([known, custom]).toEqual(['contains', 'collaborates-with']);
  });
});

// ── T1.3 relation taxonomy + edge styling ──────────────────

describe('edge relation styling (T1.3)', () => {
  it('styles each known relation from RELATION_STYLES', () => {
    for (const relation of Object.keys(RELATION_STYLES)) {
      const style = getEdgeStyle({ relation });
      expect(style).toEqual(RELATION_STYLES[relation as keyof typeof RELATION_STYLES]);
    }
  });

  it('relation takes precedence over type', () => {
    const style = getEdgeStyle({ type: 'contains', relation: 'leads' });
    expect(style).toEqual(RELATION_STYLES.leads);
  });

  it('unknown relation gets a default style with a humanized label', () => {
    const style = getEdgeStyle({ relation: 'mentors-junior' });
    expect(style.label).toBe('Mentors Junior');
    expect(style.color).toBeTruthy();
  });

  it('falls back to type style when no relation', () => {
    expect(getEdgeStyle({ type: 'imports' })).toEqual(EDGE_TYPE_STYLES.imports);
  });

  it('keeps the "related" visual style but a distinct humanized label for an unknown open type', () => {
    const style = getEdgeStyle({ type: 'mystery' });
    expect(style.color).toBe(EDGE_TYPE_STYLES.related.color);
    expect(style.dashes).toEqual(EDGE_TYPE_STYLES.related.dashes);
    expect(style.width).toBe(EDGE_TYPE_STYLES.related.width);
    // label preserves the actual type so the legend can distinguish new edges
    expect(style.label).toBe('Mystery');
  });

  it('an empty edge ({}) resolves to the plain "related" style', () => {
    expect(getEdgeStyle({})).toEqual(EDGE_TYPE_STYLES.related);
  });

  it('legend key prefers relation, else type', () => {
    expect(getEdgeLegendKey({ type: 'contains', relation: 'leads' })).toBe('leads');
    expect(getEdgeLegendKey({ type: 'contains' })).toBe('contains');
    expect(getEdgeLegendKey({})).toBe('related');
  });

  it('getEdgeWeight is open-safe', () => {
    expect(getEdgeWeight('contains')).toBe(5.0);
    expect(getEdgeWeight('unknown-edge')).toBe(1);
    expect(getEdgeWeight(undefined)).toBe(EDGE_TYPE_WEIGHTS.related);
  });
});
