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
} from '@fluentui/react-icons';
import type { KBGraph, KBConfig, KBNode, Cluster } from '../types';
import { NodeVisual } from '../components/NodeVisual';
import { HomePageWidgets } from '../components/HomePageWidgets';
import { ConstellationHero } from '../components/ConstellationHero';
import { IconGallery } from '../components/IconGallery';

interface ReadingViewProps {
  graph: KBGraph;
  config: KBConfig;
  nodeId: string;
}

function findCluster(config: KBConfig, clusters: Cluster[], clusterId: string) {
  const meta = config.clusters[clusterId];
  const cluster = clusters.find(c => c.id === clusterId);
  return {
    name: meta?.name ?? cluster?.name ?? clusterId,
    color: meta?.color ?? cluster?.color ?? '#888',
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
  // responsive — desktop sidebar
  '@media (min-width: 1025px)': {
    body: {
      flexDirection: 'row',
    },
  },
});

/* ── Display-mode helper components ─────────────────────────── */

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

function renderContent(node: KBNode, linkedHtml: string, graph?: KBGraph, config?: KBConfig) {
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
      return (
        <div>
          <Caption1 style={{ display: 'block', marginBottom: tokens.spacingVerticalS, color: tokens.colorNeutralForeground3 }}>
            Diagram rendering coming soon
          </Caption1>
          <pre className="kb-code-display"><code>{node.rawContent}</code></pre>
        </div>
      );
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
          <div className="kb-prose" dangerouslySetInnerHTML={{ __html: linkedHtml }} />
          {graph && config && <HomePageWidgets graph={graph} config={config} />}
        </div>
      );
    case 'gallery':
      return (
        <div>
          <div className="kb-prose" dangerouslySetInnerHTML={{ __html: linkedHtml }} />
          <IconGallery />
        </div>
      );
    default:
      return <div className="kb-prose" dangerouslySetInnerHTML={{ __html: linkedHtml }} />;
  }
}

export function ReadingView({ graph, config, nodeId }: ReadingViewProps) {
  const styles = useStyles();
  const node = graph.nodes.find(n => n.id === nodeId);

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
    <div className={styles.root}>
      {/* Hero image */}
      {showHero && (
        <NodeVisual node={node} mode={mode} surface="hero" source={source} />
      )}

      {/* Back link — hide on homepage (it IS home) */}
      {!isHomepage && (
        <div className={styles.backLink}>
          <Button appearance="subtle" icon={<ArrowLeftRegular />} as="a" href="#/">
            Home
          </Button>
        </div>
      )}

      {/* Header — skip for homepage (ConstellationHero handles it) */}
      {!isHomepage && (
        <header className={`${styles.header} ${showHero ? styles.headerHero : ''}`}>
          <div className={styles.headerVisual}>
            {!showHero && (mode === 'sprites' && node.sprite) && (
              <NodeVisual node={node} mode={mode} surface="header" source={source} clusterColor={cluster.color} />
            )}
            {!showHero && mode === 'emoji' && node.emoji && (
              <NodeVisual node={node} mode="emoji" surface="header" source={source} clusterColor={cluster.color} />
            )}
          </div>
          <div className={styles.clusterBadge}>
            <Badge appearance="tint" color="informative">{cluster.name}</Badge>
          </div>
          <Title1>{node.title}</Title1>
        </header>
      )}

      {/* Body: prose + connections */}
      <div className={`${styles.body} kb-reading-body`}>
        {renderContent(node, linkifyContent(node.content), graph, config)}

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
                        <NodeVisual node={child} mode={config.visuals.mode} surface="hud-thumb" source={config.source} clusterColor={childCluster.color} />
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
      </div>
    </div>
  );
}
