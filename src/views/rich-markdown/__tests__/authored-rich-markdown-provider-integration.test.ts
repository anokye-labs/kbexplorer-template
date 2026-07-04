/**
 * Template-side integration test (anokye-labs/kbexplorer-template#472, slice 2/5).
 *
 * `AuthoredRichMarkdownProvider` moved into `@anokye-labs/kbexplorer-engine`. Its
 * engine-side unit test dropped/trimmed the assertions below because they exercise
 * template's `views/rich-markdown` view layer (`isRichMarkdownNode`,
 * `getRichMarkdownDocument`, `planProseFence`), which stays in template per issue
 * #472's disposition table ("all React viewers/theme/views" stays). This file
 * restores that coverage as a cross-layer integration test: real provider output
 * (from the published package) read through template's own view-layer functions.
 *
 * Coverage restored here (see kbexplorer-engine#3 PR body for the full judgment-call
 * writeup):
 *   - `isRichMarkdownNode(node)` recognizing provider output (trimmed from
 *     "ingests a rich-markdown authored doc…").
 *   - "surfaces frontmatter facts in the structured view payload" (fully dropped).
 *   - "maps embedded blocks to the template contract (kind/source/hash)" (fully
 *     dropped).
 *   - "renders the mermaid block live and the dot block via the fallback seam"
 *     (fully dropped).
 *   - the frontmatter-facts assertion inside "never renders YAML frontmatter as
 *     visible prose" (trimmed).
 */
import { describe, it, expect } from 'vitest';
import { AuthoredRichMarkdownProvider } from '@anokye-labs/kbexplorer-engine';
import type { KBConfig } from '../../../types';
import { DEFAULT_CONFIG } from '../../../types';
import { isRichMarkdownNode, getRichMarkdownDocument, planProseFence } from '../index';

const config: KBConfig = DEFAULT_CONFIG;

const MERMAID_SOURCE = `flowchart LR
  A --> B`;
const DOT_SOURCE = `digraph G {
  build -> test;
}`;

// An authored doc that opts into rich-Markdown and embeds a live (mermaid) and a
// fallback (dot) block. Kept identical to the provider's own fixture so the two
// suites stay in lockstep.
const richDoc = `---
id: platform
title: Platform Overview
display: rich-markdown
cluster: docs
owner: Team Atlas
tags: [release, ci]
---

# Platform Overview

The platform pipeline embeds a live diagram plus a Graphviz block.

\`\`\`mermaid
${MERMAID_SOURCE}
\`\`\`

\`\`\`dot
${DOT_SOURCE}
\`\`\`
`;

describe('AuthoredRichMarkdownProvider × views/rich-markdown (cross-layer integration)', () => {
  it('produces a node the view layer recognizes as rich-Markdown', async () => {
    const provider = new AuthoredRichMarkdownProvider({ 'content/org/platform.md': richDoc });
    const { nodes } = await provider.resolve(config, []);

    expect(nodes).toHaveLength(1);
    expect(isRichMarkdownNode(nodes[0]!)).toBe(true);
  });

  it('surfaces frontmatter facts in the structured view payload', async () => {
    const provider = new AuthoredRichMarkdownProvider({ 'content/org/platform.md': richDoc });
    const { nodes } = await provider.resolve(config, []);

    const doc = getRichMarkdownDocument(nodes[0]!);
    expect(doc).not.toBeNull();
    expect(doc!.frontmatter).toMatchObject({
      title: 'Platform Overview',
      owner: 'Team Atlas',
    });
    expect(doc!.frontmatter!.tags).toEqual(['release', 'ci']);
  });

  it('maps embedded blocks to the template contract (kind/source/hash)', async () => {
    const provider = new AuthoredRichMarkdownProvider({ 'content/org/platform.md': richDoc });
    const { nodes } = await provider.resolve(config, []);

    const doc = getRichMarkdownDocument(nodes[0]!)!;
    const kinds = doc.blocks.map((b) => b.kind);
    expect(kinds).toContain('mermaid');
    expect(kinds).toContain('dot');

    const mermaid = doc.blocks.find((b) => b.kind === 'mermaid')!;
    expect(mermaid.source.trim()).toBe(MERMAID_SOURCE);
    expect(mermaid.hash).toMatch(/^sha256:hex:[0-9a-f]{64}$/);
    expect(mermaid.range).toBeDefined();
  });

  it('renders the mermaid block live and the dot block via the fallback seam', async () => {
    const provider = new AuthoredRichMarkdownProvider({ 'content/org/platform.md': richDoc });
    const { nodes } = await provider.resolve(config, []);
    const doc = getRichMarkdownDocument(nodes[0]!)!;

    // mermaid → live Mermaid path.
    const mermaidPlan = planProseFence('mermaid', MERMAID_SOURCE, doc.blocks);
    expect(mermaidPlan.type).toBe('mermaid');

    // dot → resolves through the block registry; with no provider-supplied SVG
    // it degrades gracefully to the raw-source fallback (never blanks).
    const dotPlan = planProseFence('dot', DOT_SOURCE, doc.blocks);
    expect(dotPlan.type).toBe('unsupported');
    if (dotPlan.type === 'unsupported') {
      expect(dotPlan.source.trim()).toBe(DOT_SOURCE);
    }
  });

  it('never renders YAML frontmatter as visible prose, and frontmatter facts stay available to the structured view', async () => {
    const provider = new AuthoredRichMarkdownProvider({ 'content/org/platform.md': richDoc });
    const { nodes } = await provider.resolve(config, []);
    const { content, rawContent } = nodes[0]!;

    expect(content).not.toContain('---');
    expect(content).not.toContain('display: rich-markdown');
    expect(rawContent).not.toContain('---');
    expect(getRichMarkdownDocument(nodes[0]!)!.frontmatter).toMatchObject({ owner: 'Team Atlas' });
  });
});
