import { describe, it, expect } from 'vitest';
import {
  tokenize,
  stripMarkdown,
  extractHeadings,
  buildSearchIndex,
  searchIndex,
} from '../index';
import type { KBNode } from '../../types';

// ── Helpers ────────────────────────────────────────────────

function makeNode(id: string, title: string, rawContent = '', overrides: Partial<KBNode> = {}): KBNode {
  return {
    id,
    title,
    cluster: 'test',
    content: '',
    rawContent,
    connections: [],
    source: { type: 'authored', file: `content/${id}.md` },
    ...overrides,
  };
}

// ── tokenize ───────────────────────────────────────────────

describe('tokenize', () => {
  it('splits on non-word characters', () => {
    expect(tokenize('Hello, World!')).toEqual(['hello', 'world']);
  });

  it('lowercases tokens', () => {
    expect(tokenize('React TypeScript')).toEqual(['react', 'typescript']);
  });

  it('filters tokens shorter than 2 chars', () => {
    expect(tokenize('a b cd')).toEqual(['cd']);
  });

  it('returns empty for empty string', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('handles unicode letters', () => {
    const result = tokenize('Café naïve');
    expect(result).toContain('café');
  });
});

// ── stripMarkdown ──────────────────────────────────────────

describe('stripMarkdown', () => {
  it('removes heading markers', () => {
    expect(stripMarkdown('## Overview\nSome text')).not.toContain('##');
  });

  it('removes fenced code blocks', () => {
    const md = '```js\nconsole.log("hello");\n```\nAfter code';
    const stripped = stripMarkdown(md);
    expect(stripped).not.toContain('console.log');
    expect(stripped).toContain('After code');
  });

  it('removes inline code', () => {
    const stripped = stripMarkdown('Use `npm install` to get started');
    expect(stripped).not.toContain('npm install');
  });

  it('preserves link text', () => {
    const stripped = stripMarkdown('[click here](https://example.com)');
    expect(stripped).toContain('click here');
  });
});

// ── extractHeadings ────────────────────────────────────────

describe('extractHeadings', () => {
  it('extracts all heading levels', () => {
    const md = '# Title\n## Section\n### Sub';
    const headings = extractHeadings(md);
    expect(headings).toContain('Title');
    expect(headings).toContain('Section');
    expect(headings).toContain('Sub');
  });

  it('returns empty string for no headings', () => {
    expect(extractHeadings('Just body text')).toBe('');
  });
});

// ── buildSearchIndex ───────────────────────────────────────

describe('buildSearchIndex', () => {
  it('creates entries for each node', () => {
    const nodes = [
      makeNode('a', 'Alpha'),
      makeNode('b', 'Beta'),
    ];
    const index = buildSearchIndex(nodes);
    expect(index.entries).toHaveLength(2);
  });

  it('populates titleMap with node IDs', () => {
    const nodes = [makeNode('n1', 'Knowledge Graph')];
    const index = buildSearchIndex(nodes);
    expect(index.titleMap.get('knowledge')?.has('n1')).toBe(true);
    expect(index.titleMap.get('graph')?.has('n1')).toBe(true);
  });

  it('populates headingMap from rawContent headings', () => {
    const nodes = [makeNode('n1', 'Intro', '## Architecture\nsome text')];
    const index = buildSearchIndex(nodes);
    expect(index.headingMap.get('architecture')?.has('n1')).toBe(true);
  });

  it('populates bodyMap from rawContent body text', () => {
    const nodes = [makeNode('n1', 'Intro', 'Deep dive into orchestration')];
    const index = buildSearchIndex(nodes);
    expect(index.bodyMap.get('orchestration')?.has('n1')).toBe(true);
  });

  it('handles empty node list', () => {
    const index = buildSearchIndex([]);
    expect(index.entries).toHaveLength(0);
    expect(index.titleMap.size).toBe(0);
  });
});

// ── searchIndex ────────────────────────────────────────────

describe('searchIndex — ranking', () => {
  const nodes = [
    makeNode('title-match', 'Authentication Overview', '## Summary\nSign in flow'),
    makeNode('heading-match', 'System Design', '## Authentication Flow\nOAuth 2.0'),
    makeNode('body-match', 'Operations', 'authentication is handled by the auth service'),
  ];
  const index = buildSearchIndex(nodes);

  it('returns empty for blank query', () => {
    expect(searchIndex(index, '')).toHaveLength(0);
    expect(searchIndex(index, '   ')).toHaveLength(0);
  });

  it('title match scores higher than heading match', () => {
    const results = searchIndex(index, 'authentication');
    expect(results.length).toBeGreaterThanOrEqual(2);
    const titleIdx = results.findIndex(r => r.nodeId === 'title-match');
    const headingIdx = results.findIndex(r => r.nodeId === 'heading-match');
    expect(titleIdx).toBeLessThan(headingIdx);
  });

  it('heading match scores higher than body match', () => {
    const results = searchIndex(index, 'authentication');
    const headingIdx = results.findIndex(r => r.nodeId === 'heading-match');
    const bodyIdx = results.findIndex(r => r.nodeId === 'body-match');
    // Both may appear; heading should rank before body
    expect(headingIdx).toBeLessThan(bodyIdx);
  });

  it('reports correct matchField', () => {
    const results = searchIndex(index, 'authentication');
    const titleResult = results.find(r => r.nodeId === 'title-match');
    expect(titleResult?.matchField).toBe('title');
    const headingResult = results.find(r => r.nodeId === 'heading-match');
    expect(headingResult?.matchField).toBe('heading');
  });

  it('prefix match works (partial query)', () => {
    const results = searchIndex(index, 'authen');
    expect(results.some(r => r.nodeId === 'title-match')).toBe(true);
  });

  it('returns at most the limit', () => {
    const manyNodes = Array.from({ length: 30 }, (_, i) =>
      makeNode(`n${i}`, `Node ${i}`, `body content node ${i}`)
    );
    const bigIndex = buildSearchIndex(manyNodes);
    const results = searchIndex(bigIndex, 'node', 5);
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it('returns cluster + type metadata', () => {
    const results = searchIndex(index, 'authentication');
    const r = results.find(r => r.nodeId === 'title-match');
    expect(r?.cluster).toBe('test');
    expect(r?.type).toBe('authored');
  });

  it('no results for unrelated query', () => {
    const results = searchIndex(index, 'completelymadeupwordxyz');
    expect(results).toHaveLength(0);
  });
});
