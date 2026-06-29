import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  makeStyles,
  tokens,
  Button,
  Title1,
  Badge,
  Caption1,
  Card,
  Body1Strong,
} from '@fluentui/react-components';
import {
  ArrowLeftRegular,
  GridRegular,
} from '@fluentui/react-icons';
import type { KBGraph, KBConfig, KBNode, Cluster } from '../types';
import { NodeVisual } from '../components/NodeVisual';
import { clusterTokenStyle } from '../theme/clusterTokens';
import { pageThemeStyle } from '../theme/pageTheme';
import { buildThemeMap, isDarkTheme } from '../hooks/useTheme';
import type { Theme as FluentTheme } from '@fluentui/react-components';
import { HomePageWidgets } from '../components/HomePageWidgets';
import { ConstellationHero } from '../components/ConstellationHero';
import { IconGallery } from '../components/IconGallery';
import { resolveViewer } from './viewers';
import { SourceEditor } from './SourceEditor';
import { canEditSource } from '../engine/source-edit';
import {
  diagramLanguageFromClassName,
  getDiagramRenderPlan,
  isDiagramCodeLanguage,
} from './diagram';

interface ReadingViewProps {
  graph: KBGraph;
  config: KBConfig;
  nodeId: string;
  /** Active resolved Fluent theme; the base that per-page deltas layer onto. */
  theme?: FluentTheme;
}

function findCluster(config: KBConfig, clusters: Cluster[], clusterId: string) {
  const meta = config.clusters[clusterId];
  const cluster = clusters.find(c => c.id === clusterId);
  return {
    name: meta?.name ?? cluster?.name ?? clusterId,
    color: meta?.color ?? cluster?.color ?? '#888',
    tokens: meta?.tokens ?? cluster?.tokens,
  };
}

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  backLink: {
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalXL}`,
  },
  header: {
    padding: `0 ${tokens.spacingHorizontalXL} ${tokens.spacingVerticalXXL}`,
    maxWidth: 'var(--prose-max-width, 75%)',
    width: '100%',
    margin: '0 auto',
  },
  headerHero: {
    position: 'relative',
    marginTop: '-8rem',
    zIndex: 1,
    paddingTop: 0,
  },
  headerVisual: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalS,
  },
  clusterBadge: {
    marginBottom: tokens.spacingVerticalS,
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    maxWidth: 'var(--prose-max-width, 75%)',
    width: '100%',
    margin: '0 auto',
    padding: `0 ${tokens.spacingHorizontalXL} ${tokens.spacingVerticalXXXL}`,
    gap: tokens.spacingVerticalXXXL,
  },
  connectionsAside: {
    flexShrink: 0,
  },
  connectionsTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalM,
  },
  connectionsList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: tokens.spacingVerticalS,
  },
  connectionCard: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalSNudge,
    textDecoration: 'none',
    color: 'inherit',
    cursor: 'pointer',
  },
  connectionInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingHorizontalXXS,
    minWidth: 0,
    flex: 1,
  },
  connectionTitle: {
    fontWeight: tokens.fontWeightSemibold,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  connectionPill: {
    marginLeft: 'auto',
    flexShrink: 0,
  },
  notFound: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    gap: tokens.spacingVerticalM,
    textAlign: 'center',
    padding: tokens.spacingHorizontalXXL,
  },
  childNodes: {
    marginTop: tokens.spacingVerticalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  relations: {
    marginTop: tokens.spacingVerticalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  relationsTitle: {
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  // responsive — desktop sidebar
  '@media (min-width: 1025px)': {
    body: {
      flexDirection: 'row',
    },
  },
});

/* ── Display-mode helper components ─────────────────────────── */

type MermaidApi = typeof import('mermaid').default;
type MermaidTheme = 'dark' | 'default';

let mermaidImport: Promise<MermaidApi> | null = null;
let initializedMermaidTheme: MermaidTheme | null = null;
let mermaidRenderSequence = 0;

function nextMermaidRenderId(): string {
  mermaidRenderSequence += 1;
  return `kb-mermaid-${mermaidRenderSequence}`;
}

async function loadMermaid(isDark: boolean): Promise<MermaidApi> {
  const theme: MermaidTheme = isDark ? 'dark' : 'default';
  mermaidImport ??= import('mermaid').then(mod => mod.default);
  const mermaid = await mermaidImport;
  if (initializedMermaidTheme !== theme) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme,
    });
    initializedMermaidTheme = theme;
  }
  return mermaid;
}

async function renderMermaid(source: string, isDark: boolean) {
  const mermaid = await loadMermaid(isDark);
  return mermaid.render(nextMermaidRenderId(), source);
}

function diagramErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown Mermaid render error.';
}

function isSvgRoot(element: Element): element is SVGSVGElement {
  return element.nodeName.toLowerCase() === 'svg'
    && element.namespaceURI === 'http://www.w3.org/2000/svg';
}

function normalizeMermaidSvgForXml(svg: string): string {
  // Mermaid can emit HTML-style breaks inside foreignObject labels; XML parsing
  // requires them to be self-closed before we import the SVG node.
  return svg.replace(/<br>/gi, '<br/>');
}

function parseMermaidSvg(svg: string): SVGSVGElement {
  const doc = new DOMParser().parseFromString(normalizeMermaidSvgForXml(svg), 'image/svg+xml');
  const parserError = doc.querySelector('parsererror');
  const svgElement = doc.documentElement;
  if (parserError) {
    const parserMessage = parserError.textContent?.trim().split('\n')[0];
    throw new Error(`Mermaid returned invalid SVG${parserMessage ? `: ${parserMessage}` : '.'}`);
  }
  if (!isSvgRoot(svgElement)) {
    throw new Error(`Mermaid returned invalid SVG root "${svgElement.nodeName}".`);
  }
  const imported: Element = document.importNode(svgElement, true);
  if (!isSvgRoot(imported)) {
    throw new Error(`Mermaid returned invalid imported SVG root "${imported.nodeName}".`);
  }
  return imported;
}

function DiagramFallback({
  message,
  source,
  severity = 'error',
}: {
  message: string;
  source: string;
  severity?: 'error' | 'warning';
}) {
  return (
    <div className="kb-diagram-block">
      <div className="kb-diagram-fallback" data-severity={severity} role={severity === 'error' ? 'alert' : undefined}>
        {message}
      </div>
      <pre className="kb-code-display"><code>{source}</code></pre>
    </div>
  );
}

function MermaidDiagram({ source, isDark }: { source: string; isDark: boolean }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'rendered' | 'error'>('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.textContent = '';
    setStatus('loading');
    setError('');

    void (async () => {
      try {
        const { svg, bindFunctions } = await renderMermaid(source, isDark);
        const svgElement = parseMermaidSvg(svg);
        if (cancelled) return;
        canvas.replaceChildren(svgElement);
        bindFunctions?.(canvas);
        setStatus('rendered');
      } catch (err) {
        if (cancelled) return;
        canvas.textContent = '';
        setError(diagramErrorMessage(err));
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isDark, source]);

  return (
    <figure className="kb-diagram" data-diagram-language="mermaid">
      {status === 'loading' && (
        <Caption1 className="kb-diagram-status">Rendering Mermaid diagram...</Caption1>
      )}
      <div ref={canvasRef} className="kb-diagram-canvas" aria-hidden={status !== 'rendered'} />
      {status === 'error' && (
        <DiagramFallback message={`Mermaid render failed: ${error}`} source={source} />
      )}
      {status === 'rendered' && (
        <details className="kb-diagram-source">
          <summary>Diagram source</summary>
          <pre className="kb-code-display"><code>{source}</code></pre>
        </details>
      )}
    </figure>
  );
}

function createDiagramMessage(message: string, severity: 'error' | 'warning'): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'kb-diagram-fallback';
  el.dataset.severity = severity;
  if (severity === 'error') el.setAttribute('role', 'alert');
  el.textContent = message;
  return el;
}

function wrapRenderedProseDiagram(pre: HTMLPreElement, svgElement: SVGSVGElement, bindFunctions?: (element: Element) => void) {
  const figure = document.createElement('figure');
  figure.className = 'kb-diagram kb-diagram--prose';
  figure.dataset.diagramLanguage = 'mermaid';

  const canvas = document.createElement('div');
  canvas.className = 'kb-diagram-canvas';
  canvas.replaceChildren(svgElement);
  figure.append(canvas);
  bindFunctions?.(canvas);

  const details = document.createElement('details');
  details.className = 'kb-diagram-source';
  const summary = document.createElement('summary');
  summary.textContent = 'Diagram source';
  details.append(summary);

  pre.before(figure);
  figure.after(details);
  details.append(pre);
}

function ProseContent({
  html,
  isDark,
  style,
}: {
  html: string;
  isDark: boolean;
  style?: CSSProperties;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    root.innerHTML = html;
    let cancelled = false;

    const codeBlocks = Array.from(root.querySelectorAll<HTMLElement>('pre > code'));

    void (async () => {
      for (const code of codeBlocks) {
        if (cancelled) return;
        const language = diagramLanguageFromClassName(code.className);
        if (!isDiagramCodeLanguage(language)) continue;

        const pre = code.parentElement;
        if (!(pre instanceof HTMLPreElement)) continue;

        const plan = getDiagramRenderPlan(code.textContent ?? '', language);
        if (plan.kind !== 'mermaid') {
          pre.before(createDiagramMessage(plan.reason, 'warning'));
          continue;
        }

        try {
          const { svg, bindFunctions } = await renderMermaid(plan.source, isDark);
          const svgElement = parseMermaidSvg(svg);
          if (cancelled) return;
          wrapRenderedProseDiagram(pre, svgElement, bindFunctions);
        } catch (err) {
          if (cancelled) return;
          pre.before(createDiagramMessage(`Mermaid render failed: ${diagramErrorMessage(err)}`, 'error'));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [html, isDark]);

  return (
    <div
      ref={rootRef}
      className="kb-prose"
      style={style}
    />
  );
}

function DiagramView({ content, isDark }: { content: string; isDark: boolean }) {
  const plan = getDiagramRenderPlan(content);
  return plan.kind === 'mermaid'
    ? <MermaidDiagram source={plan.source} isDark={isDark} />
    : <DiagramFallback message={plan.reason} source={plan.source} severity="warning" />;
}

interface TreeEntry {
  name: string;
  depth: number;
  isDir: boolean;
}

function buildTree(content: string): TreeEntry[] {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const entries: TreeEntry[] = [];
  const seenDirs = new Set<string>();

  for (const line of lines) {
    const parts = line.replace(/\\/g, '/').split('/');
    // Emit implicit parent directories
    for (let i = 0; i < parts.length - 1; i++) {
      const dirPath = parts.slice(0, i + 1).join('/');
      if (!seenDirs.has(dirPath)) {
        seenDirs.add(dirPath);
        entries.push({ name: parts[i], depth: i, isDir: true });
      }
    }
    // Leaf — directory if it ends with /
    const isDir = line.endsWith('/');
    const leafName = parts[parts.length - 1].replace(/\/$/, '');
    if (leafName) {
      entries.push({ name: leafName, depth: parts.length - 1, isDir });
    }
  }
  return entries;
}

function TreeView({ content }: { content: string }) {
  const entries = buildTree(content);
  return (
    <div className="kb-tree-display">
      {entries.map((e, i) => (
        <div key={i} style={{ paddingLeft: `${e.depth * 1.25}em` }}>
          {e.isDir ? '📁' : '📄'} {e.name}
        </div>
      ))}
    </div>
  );
}

function FileListView({ content }: { content: string }) {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const rows = lines.map(line => {
    // Support "path  size" format (2+ spaces or tab delimiter)
    const match = line.match(/^(.+?)(?:\s{2,}|\t)(.+)$/);
    return match
      ? { path: match[1].trim(), size: match[2].trim() }
      : { path: line, size: '' };
  });

  return (
    <div className="kb-file-list">
      <table className="kb-prose" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>File</th>
            {rows.some(r => r.size) && <th style={{ textAlign: 'right' }}>Size</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td><code>{r.path}</code></td>
              {rows.some(r2 => r2.size) && (
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.size}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableView({ content }: { content: string }) {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length === 0) return <pre className="kb-code-display"><code>{content}</code></pre>;

  // Detect delimiter: pipes or tabs
  const isPipe = lines[0].includes('|');
  const splitRow = (line: string) =>
    isPipe
      ? line.split('|').map(c => c.trim()).filter((_, i, a) =>
          // strip leading/trailing empty cells from |col1|col2| format
          !(i === 0 && a[0] === '') && !(i === a.length - 1 && a[a.length - 1] === ''))
      : line.split('\t');

  const isSeparator = (line: string) => /^[\s|:-]+$/.test(line);

  const headerRow = splitRow(lines[0]);
  const dataStart = lines.length > 1 && isSeparator(lines[1]) ? 2 : 1;
  const dataRows = lines.slice(dataStart).filter(l => !isSeparator(l)).map(splitRow);

  return (
    <div className="kb-file-list">
      <table className="kb-prose" style={{ width: '100%' }}>
        <thead>
          <tr>{headerRow.map((h, i) => <th key={i}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {dataRows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => <td key={ci}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderContent(node: KBNode, linkedHtml: string, isDark: boolean, graph?: KBGraph, config?: KBConfig) {
  switch (node.display) {
    case 'code':
      return <pre className="kb-code-display"><code>{node.rawContent}</code></pre>;
    case 'tree':
      return <TreeView content={node.rawContent} />;
    case 'file-list':
      return <FileListView content={node.rawContent} />;
    case 'table':
      return <TableView content={node.rawContent} />;
    case 'diagram':
      return <DiagramView content={node.rawContent} isDark={isDark} />;
    case 'homepage':
      return (
        <div>
          {graph && (
            <ConstellationHero graph={graph} height="40vh">
              <div style={{ textAlign: 'center', color: tokens.colorNeutralForeground1 }}>
                <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 700, letterSpacing: '-0.03em', margin: '0 0 0.5rem', lineHeight: 1.1 }}>
                  {node.title}
                </h1>
                <p style={{ opacity: 0.65, fontSize: 'clamp(0.95rem, 1.5vw, 1.15rem)', margin: '0 0 1.25rem', maxWidth: '40ch', marginLeft: 'auto', marginRight: 'auto' }}>
                  Explore the knowledge constellation
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <a href="#/node/readme" style={{ padding: '0.5rem 1.5rem', borderRadius: '2rem', background: '#4A9CC8', color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
                    Explore the Graph
                  </a>
                  <a href="#/overview" style={{ padding: '0.5rem 1.5rem', borderRadius: '2rem', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', textDecoration: 'none', fontWeight: 500, fontSize: '0.9rem' }}>
                    Browse All Nodes
                  </a>
                </div>
              </div>
            </ConstellationHero>
          )}
          <ProseContent html={linkedHtml} isDark={isDark} />
          {graph && config && <HomePageWidgets graph={graph} config={config} />}
        </div>
      );
    case 'gallery':
      return (
        <div>
          <ProseContent html={linkedHtml} isDark={isDark} />
          <IconGallery />
        </div>
      );
    case 'entity': {
      const Viewer = resolveViewer(node);
      return (
        <div>
          <Viewer node={node} />
          {node.content?.trim() && (
            <ProseContent html={linkedHtml} isDark={isDark} style={{ marginTop: '1.5rem' }} />
          )}
        </div>
      );
    }
    default:
      return <ProseContent html={linkedHtml} isDark={isDark} />;
  }
}

function humanizeEntityType(t: string): string {
  return t
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Per-source-type colors for the source badge.
 *
 * Two palettes cover the full theme range:
 *   dark  — existing GitHub-palette accents (light tones on dark BG).
 *   light — darker, higher-contrast versions that meet WCAG AA on cream/white
 *           (sepia ≈ #F5ECD7, light ≈ #FFFFFF).
 *
 * WCAG AA requires 4.5:1 contrast for normal text; Badge text at 11–12 px
 * is "small text" so we target ≥ 4.5:1 on both bg extremes.
 */
const SOURCE_BADGE_COLORS: Record<string, { dark: string; light: string }> = {
  issue:       { dark: '#d29922', light: '#7A5400' },
  pull_request: { dark: '#56d364', light: '#1A6B2A' },
  commit:      { dark: '#8b949e', light: '#4A5260' },
  file:        { dark: '#9A8A78', light: '#5C4A38' },
  authored:    { dark: '#58a6ff', light: '#0050A0' },
  derived:     { dark: '#e8a854', light: '#7A4A00' },
  readme:      { dark: '#58a6ff', light: '#0050A0' },
  external:    { dark: '#79C0FF', light: '#0050A0' },
  branch:      { dark: '#a78bfa', light: '#4A1F9A' },
  workflow:    { dark: '#e3b341', light: '#7A5200' },
  repository:  { dark: '#56d364', light: '#1A6B2A' },
  section:     { dark: '#8b949e', light: '#4A5260' },
  structured:  { dark: '#c0a3ff', light: '#4A1F9A' },
};

/** Describes where a node comes from — shown as a badge next to the cluster */
function SourceBadge({ node, config, isDark }: { node: KBNode; config: KBConfig; isDark: boolean }) {
  const repo = `${config.source.owner}/${config.source.repo}`
  const s = node.source

  let label: string

  switch (s.type) {
    case 'issue':
      label = `GitHub Issue · ${repo} #${s.number}`
      break
    case 'pull_request':
      label = `GitHub PR · ${repo} #${s.number}`
      break
    case 'commit':
      label = `GitHub Commits · ${repo}`
      break
    case 'file':
      label = `File · ${s.path}`
      break
    case 'authored':
      label = `Authored · ${s.file.replace(/.*\//, '')}`
      break
    case 'derived':
      label = `Derived Content`
      break
    case 'readme':
      label = `README · ${repo}`
      break
    case 'external':
      label = `External · ${s.provider}`
      break
    case 'branch':
      label = `Branch · ${s.name}${s.protected ? ' 🛡️' : ''}`
      break
    case 'workflow':
      label = `Workflow · ${s.path.replace('.github/workflows/', '')}`
      break
    case 'repository':
      label = `Repository · ${s.owner}/${s.repo}`
      break
    case 'section':
      label = 'Section'
      break
    case 'structured':
      label = `Entity · ${humanizeEntityType(s.entityType)}`
      break
    default:
      return null
  }

  const palette = SOURCE_BADGE_COLORS[s.type];
  const color = palette ? (isDark ? palette.dark : palette.light) : (isDark ? '#8b949e' : '#4A5260');

  return (
    <Badge
      appearance="outline"
      size="small"
      style={{ color, borderColor: color + '66', fontWeight: 400 }}
    >
      {label}
    </Badge>
  )
}

export function ReadingView({ graph, config, nodeId, theme }: ReadingViewProps) {
  const styles = useStyles();
  const node = graph.nodes.find(n => n.id === nodeId);

  // Derive dark/light flag from the resolved Fluent theme so config themes
  // (arbitrary key names) drive contrast decisions correctly — not just the
  // built-in 'dark'/'light' mode strings.
  const isDark = theme ? isDarkTheme(theme) : true;

  // Runtime theme map (built-ins + config themes) for resolving a node's
  // optional named per-page theme. Rebuilt only when config.theme changes.
  const themeMap = useMemo(() => buildThemeMap(config.theme), [config.theme]);

  // Per-page theme deltas (scoped CSS vars). Empty when the node declares no
  // page theme, so unthemed pages leave the global theme untouched. This
  // (potentially non-trivial) named-theme diff / accent brand-ramp computation
  // is auto-memoized by the React Compiler, keeping a stable style identity
  // across renders without a manual useMemo. Computed before any early return.
  const pageTheme = node?.pageTheme;
  const pageStyle = theme && pageTheme ? pageThemeStyle(theme, pageTheme, themeMap) : {};

  // Build set of valid node IDs for linkification
  const nodeIds = new Set(graph.nodes.map(n => n.id));

  /** Post-process HTML to make file paths and node references clickable */
  function linkifyContent(html: string): string {
    // 1. Convert <code>src/path/file.ts</code> to clickable links when matching file node exists
    let result = html.replace(
      /<code>((?:src|scripts|content|public)\/[\w./-]+\.\w+)<\/code>/g,
      (_match, filePath: string) => {
        const fileNodeId = `file-${filePath}`;
        if (nodeIds.has(fileNodeId)) {
          return `<a href="#/node/${encodeURIComponent(fileNodeId)}" class="kb-file-link"><code>${filePath}</code></a>`;
        }
        return `<code>${filePath}</code>`;
      }
    );

    // 2. Remap GitHub issue/PR URLs to graph nodes (skip "View on GitHub" external links)
    result = result.replace(
      /<a href="(https?:\/\/github\.com\/[^"]*?\/(issues|pull)\/(\d+))">([^<]*)<\/a>/g,
      (match, url: string, type: string, num: string, text: string) => {
        if (text.includes('↗') || text.includes('View on GitHub')) {
          return `<a href="${url}" target="_blank" rel="noopener">${text}</a>`;
        }
        const nodeId = type === 'pull' ? `pr-${num}` : `issue-${num}`;
        if (nodeIds.has(nodeId)) {
          return `<a href="#/node/${encodeURIComponent(nodeId)}">${text}</a>`;
        }
        return match;
      }
    );

    // 3. Convert markdown-generated <a href="node-id"> to hash-based graph navigation
    result = result.replace(
      /<a href="([^"#/][^"]*)">/g,
      (_match, target: string) => {
        if (nodeIds.has(target)) {
          return `<a href="#/node/${encodeURIComponent(target)}">`;
        }
        return `<a href="${target}">`;
      }
    );

    // 4. Make external links open in new tab
    result = result.replace(
      /<a href="(https?:\/\/[^"]+)">/g,
      '<a href="$1" target="_blank" rel="noopener">'
    );

    return result;
  }

  if (!node) {
    return (
      <div className={styles.notFound}>
        <span style={{ fontSize: tokens.fontSizeHero800 }}>🔍</span>
        <Title1>Node not found</Title1>
        <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
          No node with id &quot;{nodeId}&quot; exists in this knowledge base.
        </Caption1>
        <Button appearance="subtle" icon={<ArrowLeftRegular />} as="a" href="#/">
          Home
        </Button>
      </div>
    );
  }

  const mode = config.visuals.mode;
  const source = config.source;
  const cluster = findCluster(config, graph.clusters, node.cluster);

  const showHero = mode === 'heroes' && !!node.image;
  const isHomepage = node.display === 'homepage';

  return (
    // Keyed by node id so navigating to another node replaces this subtree,
    // automatically dropping any page-scoped vars and restoring the global
    // theme (no leakage; document root is never touched).
    <div key={node.id} className={styles.root} style={pageStyle} data-page-themed={node.pageTheme ? 'true' : undefined}>
      {/* Hero image */}
      {showHero && (
        <NodeVisual node={node} mode={mode} surface="hero" source={source} />
      )}

      {/* Navigation — hide on homepage (it IS home) */}
      {!isHomepage && (
        <div className={styles.backLink} style={{ display: 'flex', gap: 4 }}>
          <Button appearance="subtle" icon={<ArrowLeftRegular />} as="a" href="#/">
            Home
          </Button>
          <Button appearance="subtle" icon={<GridRegular />} as="a" href="#/overview">
            Cards
          </Button>
        </div>
      )}

      {/* Header — skip for homepage (ConstellationHero handles it) */}
      {!isHomepage && (
        <header
          className={`${styles.header} ${showHero ? styles.headerHero : ''}`}
          style={{ ...clusterTokenStyle(cluster.tokens), ...pageStyle }}
        >
          <div className={styles.headerVisual}>
            {!showHero && (mode === 'sprites' && node.sprite) && (
              <NodeVisual node={node} mode={mode} surface="header" source={source} clusterColor={cluster.color} isDark={isDark} />
            )}
            {!showHero && mode === 'emoji' && node.emoji && (
              <NodeVisual node={node} mode="emoji" surface="header" source={source} clusterColor={cluster.color} isDark={isDark} />
            )}
          </div>
          <div className={styles.clusterBadge} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge appearance="tint" color="informative">{cluster.name}</Badge>
            <SourceBadge node={node} config={config} isDark={isDark} />
            {canEditSource(node) && <SourceEditor node={node} config={config} />}
          </div>
          <Title1>{node.title}</Title1>
        </header>
      )}

      {/* Body: prose + connections */}
      <div className={`${styles.body} kb-reading-body`}>
        {renderContent(node, linkifyContent(node.content), isDark, graph, config)}

        {/* Child nodes (subfolders, sections) */}
        {(() => {
          const children = graph.nodes.filter(n => n.parent === node.id);
          if (children.length === 0) return null;
          return (
            <div className={styles.childNodes}>
              {children.map(child => {
                const childCluster = findCluster(config, graph.clusters, child.cluster);
                return (
                  <a key={child.id} href={`#/node/${encodeURIComponent(child.id)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <Card appearance="subtle" size="small" style={{ marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
                        <NodeVisual node={child} mode={config.visuals.mode} surface="hud-thumb" source={config.source} clusterColor={childCluster.color} isDark={isDark} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Body1Strong style={{ display: 'block' }}>{child.title}</Body1Strong>
                          {child.rawContent && (
                            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                              {child.rawContent.replace(/[#*`>\-[\]]/g, '').trim().substring(0, 100)}
                            </Caption1>
                          )}
                        </div>
                        <span style={{ width: 3, height: 24, borderRadius: 2, background: childCluster.color, flexShrink: 0 }} />
                      </div>
                    </Card>
                  </a>
                );
              })}
            </div>
          );
        })()}

        {/* Structural relations — scoped to structural-provider nodes so the
            .github → repository links (#167) are visible & navigable. Other
            node kinds are unaffected (graph data is unchanged either way). */}
        {node.provider === 'structural' && (() => {
          const byId = new Map(graph.nodes.map(n => [n.id, n]));
          const related = (node.connections ?? [])
            .filter(conn => conn.relation === 'structural')
            .map(conn => ({ conn, target: byId.get(conn.to) }))
            .filter(r => r.target !== undefined);
          if (related.length === 0) return null;
          return (
            <div className={styles.relations} data-testid="structural-relations">
              <Caption1 className={styles.relationsTitle}>Related structure</Caption1>
              {related.map(({ conn, target }) => {
                const t = target!;
                const targetCluster = findCluster(config, graph.clusters, t.cluster);
                return (
                  <a key={t.id} href={`#/node/${encodeURIComponent(t.id)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <Card appearance="subtle" size="small" style={{ marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
                        <NodeVisual node={t} mode={config.visuals.mode} surface="hud-thumb" source={config.source} clusterColor={targetCluster.color} isDark={isDark} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Body1Strong style={{ display: 'block' }}>{t.title}</Body1Strong>
                          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{conn.description}</Caption1>
                        </div>
                        <span style={{ width: 3, height: 24, borderRadius: 2, background: targetCluster.color, flexShrink: 0 }} />
                      </div>
                    </Card>
                  </a>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
