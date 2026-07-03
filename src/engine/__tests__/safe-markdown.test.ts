/**
 * XSS regression tests for template providers/parser paths that render
 * markdown through the shared defensive renderer
 * (`@anokye-labs/kbexplorer-engine`'s `renderSafeMarkdown`, moved in
 * kbexplorer-template#472, slice 1/5).
 *
 * The renderer's own unit tests (hostile-markup neutralized / legitimate
 * markup preserved) now live in the engine repo's suite. This file keeps
 * only the integration coverage: every template-side provider path that was
 * rewired onto `renderSafeMarkdown` (StructuralProvider, WorkProvider,
 * PersonProvider, parser/authored, AuthoredRichMarkdownProvider,
 * local-loader) still neutralizes the canonical payload set end to end.
 */
import { describe, it, expect } from 'vitest';
import { StructuralProvider } from '../providers/structural-provider';
import { WorkProvider } from '../providers/work-provider';
import { PersonProvider } from '../providers/person-provider';
import { AuthoredRichMarkdownProvider } from '../providers/authored-rich-markdown-provider';
import { parseMarkdownFile, issueToNode } from '../parser';
import {
  buildConfigFromManifest,
  buildKnowledgeBaseFromManifest,
  type RepoManifest,
} from '../local-loader';
import { resetNodeTypeRegistry } from '../node-types';
import { resetViewerRegistry } from '../../views/viewers';
import type { GHIssue } from '../../api';
import type { KBConfig } from '../../types';
import { DEFAULT_CONFIG } from '../../types';

const config: KBConfig = DEFAULT_CONFIG;

// ── Canonical payloads ──────────────────────────────────────

const IMG_ONERROR = '<img src=x onerror=alert(1)>';
const SVG_ONLOAD = '<svg onload=alert(1)></svg>';
const SCRIPT = '<script>alert(1)</script>';
const JS_LINK = '[x](javascript:alert(1))';
// base64 of `<script>alert(1)</script>` — a data: URL that would execute if
// ever emitted as a live href/src.
const DATA_IMAGE = '![x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)';
const VBS_LINK = '[x](vbscript:msgbox(1))';

/** One markdown body carrying every payload (block + inline positions). */
const XSS_MARKDOWN = [
  '# Doc',
  '',
  `Inline ${IMG_ONERROR} here.`,
  '',
  SVG_ONLOAD,
  '',
  SCRIPT,
  '',
  JS_LINK,
  '',
  DATA_IMAGE,
  '',
  VBS_LINK,
].join('\n');

/**
 * Assert rendered HTML carries none of the payloads as live markup:
 * no live `<script>`/`<svg>`/`onerror` element, and no script-executing
 * URL scheme in any attribute. (Escaped text like `&lt;script&gt;` is the
 * EXPECTED safe representation and deliberately does not trip these.)
 */
function expectSanitized(html: string): void {
  expect(html).not.toMatch(/<script/i);
  expect(html).not.toMatch(/<svg/i);
  expect(html).not.toMatch(/<img[^>]*onerror/i);
  expect(html).not.toMatch(/javascript:/i);
  expect(html).not.toMatch(/vbscript:/i);
  expect(html).not.toMatch(/data:text\/html/i);
}

// ── Provider-path regression tests ──────────────────────────

function makeIssue(overrides: Partial<GHIssue> & { userLogin?: string } = {}): GHIssue {
  const { userLogin, ...rest } = overrides;
  return {
    number: 1,
    title: 'Test issue',
    body: 'Issue body',
    state: 'open',
    labels: [],
    assignees: [],
    user: userLogin ? { login: userLogin } : undefined,
    html_url: 'https://github.com/test/repo/issues/1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    ...rest,
  } as GHIssue;
}

describe('XSS payloads through every markdown → HTML provider path', () => {
  it('structural: .github markdown (issue template) is sanitized', async () => {
    resetNodeTypeRegistry();
    resetViewerRegistry();
    const template = `---\nname: Bug report\nabout: Report a bug\n---\n\n${XSS_MARKDOWN}`;
    const { nodes } = await new StructuralProvider({
      '.github/ISSUE_TEMPLATE/bug.md': template,
    }).resolve(config, []);

    const node = nodes.find(n => n.entityType === 'issue-template');
    expect(node).toBeDefined();
    expectSanitized(node!.content);
    expect(node!.content).toContain('&lt;script&gt;');
  });

  it('work: issue and PR bodies are sanitized', async () => {
    const issue = makeIssue({ number: 42, body: XSS_MARKDOWN });
    const pr = {
      number: 10,
      title: 'PR #10',
      body: XSS_MARKDOWN,
      state: 'open',
      labels: [] as Array<{ name: string; color: string }>,
      html_url: 'https://github.com/test/repo/pull/10',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    };
    const { nodes } = await new WorkProvider([issue], [pr], []).resolve(config, []);

    const issueNode = nodes.find(n => n.id === 'issue-42');
    const prNode = nodes.find(n => n.id === 'pr-10');
    expect(issueNode).toBeDefined();
    expect(prNode).toBeDefined();
    expectSanitized(issueNode!.content);
    expectSanitized(prNode!.content);
  });

  it('person: hostile issue titles echoed into person content are sanitized', async () => {
    const issue = makeIssue({
      number: 7,
      title: `${IMG_ONERROR} ${SCRIPT}`,
      userLogin: 'mallory',
    });
    const { nodes } = await new PersonProvider([issue], []).resolve(config, []);

    const person = nodes.find(n => n.id === 'person-mallory');
    expect(person).toBeDefined();
    expectSanitized(person!.content);
  });

  it('parser/authored: parseMarkdownFile output is sanitized', () => {
    const raw = `---\nid: evil\ntitle: Evil Doc\ncluster: docs\n---\n\n${XSS_MARKDOWN}`;
    const node = parseMarkdownFile('content/evil.md', raw);
    expectSanitized(node.content);
    expect(node.content).toContain('&lt;script&gt;');
    // rawContent keeps the source untouched — only the HTML is defended.
    expect(node.rawContent).toContain('<script>');
  });

  it('parser/repo-aware: issueToNode output is sanitized', () => {
    const node = issueToNode(makeIssue({ number: 5, body: XSS_MARKDOWN }));
    expectSanitized(node.content);
  });

  it('rich-markdown: authored rich-markdown docs are sanitized', async () => {
    const richDoc = [
      '---',
      'id: evil-rich',
      'title: Evil Rich Doc',
      'display: rich-markdown',
      'cluster: docs',
      '---',
      '',
      XSS_MARKDOWN,
      '',
      '```mermaid',
      'flowchart LR',
      '  A --> B',
      '```',
    ].join('\n');
    const { nodes } = await new AuthoredRichMarkdownProvider({
      'content/evil.md': richDoc,
    }).resolve(config, []);

    expect(nodes).toHaveLength(1);
    expectSanitized(nodes[0].content);
    // The legitimate fenced block still renders as a prose fence.
    expect(nodes[0].content).toContain('language-mermaid');
  });

  it('local-loader: manifest pipeline README node is sanitized', async () => {
    const manifest: RepoManifest = {
      configRaw: null,
      authoredContent: {},
      tree: [],
      readme: XSS_MARKDOWN,
      issues: [],
      pullRequests: [],
      commits: [],
      generatedAt: '2026-01-01T00:00:00Z',
    };
    const cfg = buildConfigFromManifest(manifest);
    const { graph } = await buildKnowledgeBaseFromManifest(manifest, cfg);

    const readme = graph.nodes.find(n => n.id === 'readme');
    expect(readme).toBeDefined();
    expectSanitized(readme!.content);
    expect(readme!.content).toContain('&lt;script&gt;');
  });
});