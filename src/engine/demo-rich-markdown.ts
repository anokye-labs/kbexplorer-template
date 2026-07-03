import { renderSafeMarkdown } from './safe-markdown';
import type { KBNode } from '../types';

const SAMPLE_FRONTMATTER: Record<string, unknown> = {
  title: 'Release Pipeline',
  status: 'active',
  owner: 'Team Atlas',
  updated: '2026-06-30',
  tags: ['release', 'ci', 'pipeline'],
};

const MERMAID_SOURCE = `flowchart LR
  A[Build] --> B[Test]
  B --> C[Deploy]`;

const DOT_SOURCE = `digraph G {
  build -> test;
  test -> deploy;
}`;

const ICS_SOURCE = `BEGIN:VEVENT
SUMMARY:Sprint Review
DTSTART:20260701T160000Z
END:VEVENT`;

const CANVAS_SOURCE = `{ "shapes": [ { "rect": [0, 0, 128, 80] }, { "circle": [80, 48, 26] } ] }`;

const SAMPLE_DOT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80"><rect width="200" height="80" rx="8" fill="#0f172a"/><text x="16" y="44" fill="#f8fafc" font-size="18">Dependency graph</text></svg>';
const SAMPLE_ICS_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80"><rect width="200" height="80" rx="8" fill="#1d4ed8"/><text x="16" y="44" fill="#eff6ff" font-size="18">Sprint Review</text></svg>';
const SAMPLE_CANVAS_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80"><rect x="20" y="18" width="128" height="44" rx="8" fill="#f59e0b"/><circle cx="152" cy="40" r="24" fill="#ef4444"/></svg>';

const SAMPLE_RICH_MARKDOWN_RAW = `# Release Pipeline

This document describes the **release pipeline** and embeds several block kinds —
a live diagram plus three blocks that render from a pre-built SVG.

## Flow (live Mermaid)

\`\`\`mermaid
${MERMAID_SOURCE}
\`\`\`

## Dependency graph (Graphviz DOT)

\`\`\`dot
${DOT_SOURCE}
\`\`\`

## Schedule (iCalendar)

\`\`\`ics
${ICS_SOURCE}
\`\`\`

## Whiteboard (canvas)

\`\`\`canvas
${CANVAS_SOURCE}
\`\`\`
`;

function buildSampleBlocks() {
  return [
    { kind: 'mermaid', source: MERMAID_SOURCE, title: 'Release flow' },
    { kind: 'dot', source: DOT_SOURCE, svg: SAMPLE_DOT_SVG, title: 'Build dependency graph' },
    { kind: 'ics', source: ICS_SOURCE, svg: SAMPLE_ICS_SVG, title: 'Sprint Review' },
    { kind: 'canvas', source: CANVAS_SOURCE, svg: SAMPLE_CANVAS_SVG, title: 'Whiteboard sketch' },
  ];
}

export function buildSampleRichMarkdownNode(id = 'demo-richmd-doc'): KBNode {
  const content = renderSafeMarkdown(SAMPLE_RICH_MARKDOWN_RAW);
  return {
    id,
    title: 'Release Pipeline',
    cluster: 'docs',
    content,
    rawContent: SAMPLE_RICH_MARKDOWN_RAW,
    emoji: 'DocumentRegular',
    display: 'rich-markdown',
    connections: [],
    source: { type: 'derived', generator: 'rich-markdown-demo' },
    provider: 'demo-richmd',
    data: { richMarkdown: { frontmatter: SAMPLE_FRONTMATTER, blocks: buildSampleBlocks() } },
  };
}
