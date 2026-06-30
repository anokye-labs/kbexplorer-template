import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { KBNode } from '../../../types';
import {
  getRichMarkdownDocument,
  isRichMarkdownNode,
  hashBlockSource,
  normalizeBlockSource,
} from '../types';
import { FrontmatterFacts } from '../FrontmatterFacts';
import { RichMarkdownDocumentView } from '../RichMarkdownDocumentView';
import { SAMPLE_FRONTMATTER, buildSampleRichMarkdownNode } from '../sample-document';

function node(data?: Record<string, unknown>): KBNode {
  return {
    id: 'n',
    title: 'n',
    cluster: 'c',
    content: '',
    rawContent: '',
    connections: [],
    source: { type: 'derived', generator: 't' },
    data,
  };
}

describe('getRichMarkdownDocument (#427)', () => {
  it('returns null for nodes without a rich-Markdown payload', () => {
    expect(getRichMarkdownDocument(node())).toBeNull();
    expect(getRichMarkdownDocument(node({ other: 1 }))).toBeNull();
    expect(isRichMarkdownNode(node())).toBe(false);
  });

  it('reads frontmatter + blocks and skips malformed blocks', () => {
    const doc = getRichMarkdownDocument(
      node({
        richMarkdown: {
          frontmatter: { title: 'Doc' },
          blocks: [
            { kind: 'dot', source: 'digraph{}', svg: '<svg/>', hash: 'h', range: { start: 1, end: 9 } },
            { kind: 'mermaid' }, // missing source → skipped
            { source: 'x' }, // missing kind → skipped
            'not-an-object', // skipped
          ],
        },
      }),
    );
    expect(doc).not.toBeNull();
    expect(doc!.frontmatter).toEqual({ title: 'Doc' });
    expect(doc!.blocks).toHaveLength(1);
    expect(doc!.blocks[0]).toMatchObject({ kind: 'dot', svg: '<svg/>', range: { start: 1, end: 9 } });
  });

  it('reads the sample node (4 blocks + frontmatter)', () => {
    const doc = getRichMarkdownDocument(buildSampleRichMarkdownNode());
    expect(doc).not.toBeNull();
    expect(doc!.blocks.map((b) => b.kind)).toEqual(['mermaid', 'dot', 'ics', 'canvas']);
    expect(doc!.frontmatter).toMatchObject({ title: 'Release Pipeline' });
  });
});

describe('block source hashing (#427)', () => {
  it('normalizes whitespace before hashing (stable identity)', () => {
    expect(normalizeBlockSource('a  \r\nb  ')).toBe('a\nb');
    expect(hashBlockSource('digraph{}')).toBe(hashBlockSource('digraph{}\n  '));
    expect(hashBlockSource('a')).not.toBe(hashBlockSource('b'));
    expect(hashBlockSource('x')).toMatch(/^fnv1a:[0-9a-f]{8}$/);
  });
});

describe('FrontmatterFacts renders in the structured view (#427)', () => {
  it('renders the frontmatter facts', () => {
    const html = renderToStaticMarkup(createElement(FrontmatterFacts, { frontmatter: SAMPLE_FRONTMATTER }));
    expect(html).toContain('kb-structured-view');
    expect(html).toContain('Release Pipeline');
    expect(html).toContain('Owner');
    expect(html).toContain('Team Atlas');
    expect(html).toContain('Tags');
    expect(html).toContain('release');
  });

  it('renders nothing when there are no facts', () => {
    expect(renderToStaticMarkup(createElement(FrontmatterFacts, {}))).toBe('');
    expect(renderToStaticMarkup(createElement(FrontmatterFacts, { frontmatter: {} }))).toBe('');
  });
});

describe('RichMarkdownDocumentView composes facts + prose (#427)', () => {
  it('renders frontmatter facts and the prose body', () => {
    const html = renderToStaticMarkup(
      createElement(RichMarkdownDocumentView, {
        frontmatter: SAMPLE_FRONTMATTER,
        children: createElement('div', { className: 'kb-prose' }, 'PROSE-BODY'),
      }),
    );
    expect(html).toContain('richmd-document');
    expect(html).toContain('kb-richmd-body');
    expect(html).toContain('PROSE-BODY');
    // facts composed in
    expect(html).toContain('Release Pipeline');
    expect(html).toContain('richmd-frontmatter');
  });
});
