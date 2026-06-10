import { describe, it, expect, afterEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  registerViewer,
  resolveViewer,
  hasViewer,
  getRegisteredViewers,
  resetViewerRegistry,
  GenericStructuredView,
} from '../index';
import { PersonView } from '../PersonView';
import type { KBNode } from '../../../types';

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

afterEach(() => {
  resetViewerRegistry();
});

describe('viewer registry (T1.4)', () => {
  it('falls back to GenericStructuredView for unknown types', () => {
    const node = makeNode({ id: 'x', source: { type: 'structured', entityType: 'whatever' }, entityType: 'whatever' });
    expect(resolveViewer(node)).toBe(GenericStructuredView);
  });

  it('resolves a registered viewer by entityType', () => {
    registerViewer('person', PersonView);
    const node = makeNode({ id: 'p', source: { type: 'structured', entityType: 'person' }, entityType: 'person' });
    expect(resolveViewer(node)).toBe(PersonView);
    expect(hasViewer('person')).toBe(true);
    expect(getRegisteredViewers()).toContain('person');
  });

  it('resolves by JSON-LD @type when entityType is absent', () => {
    registerViewer('person', PersonView);
    const node = makeNode({
      id: 'p',
      source: { type: 'structured', entityType: 'x' },
      jsonld: { '@id': 'kg://p', '@type': ['Thing', 'person'] },
    });
    expect(resolveViewer(node)).toBe(PersonView);
  });

  it('matches keys case-insensitively', () => {
    registerViewer('Person', PersonView);
    const node = makeNode({ id: 'p', source: { type: 'structured', entityType: 'PERSON' }, entityType: 'PERSON' });
    expect(resolveViewer(node)).toBe(PersonView);
  });

  it('last registration wins (override)', () => {
    const A = () => null;
    const B = () => null;
    registerViewer('thing', A);
    registerViewer('thing', B);
    const node = makeNode({ id: 't', source: { type: 'structured', entityType: 'thing' }, entityType: 'thing' });
    expect(resolveViewer(node)).toBe(B);
  });
});

describe('GenericStructuredView render', () => {
  it('renders nested data and a JSON-LD header', () => {
    const node = makeNode({
      id: 'p',
      source: { type: 'structured', entityType: 'person' },
      entityType: 'person',
      jsonld: { '@id': 'kg://person/p', '@type': 'Person' },
      data: { name: 'Ada', skills: ['ts', 'graphs'], manager: { name: 'Lin' } },
    });
    const html = renderToStaticMarkup(createElement(GenericStructuredView, { node }));
    expect(html).toContain('kb-structured-view');
    expect(html).toContain('Ada');
    expect(html).toContain('Skills');
    expect(html).toContain('Manager');
    expect(html).toContain('Lin');
    expect(html).toContain('kg://person/p');
  });

  it('renders an empty-state message when there is no data', () => {
    const node = makeNode({ id: 'e', source: { type: 'structured', entityType: 't' }, entityType: 't' });
    const html = renderToStaticMarkup(createElement(GenericStructuredView, { node }));
    expect(html).toContain('No structured data');
  });
});

describe('PersonView render', () => {
  it('renders the person name, role and email link', () => {
    const node = makeNode({
      id: 'p',
      source: { type: 'structured', entityType: 'person' },
      entityType: 'person',
      jsonld: { '@id': 'kg://person/p', '@type': 'Person' },
      data: { name: 'Ada Okonkwo', role: 'Engineering Lead', email: 'ada@example.com' },
    });
    const html = renderToStaticMarkup(createElement(PersonView, { node }));
    expect(html).toContain('Ada Okonkwo');
    expect(html).toContain('Engineering Lead');
    expect(html).toContain('mailto:ada@example.com');
  });
});
