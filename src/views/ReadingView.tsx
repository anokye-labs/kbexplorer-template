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
import type { KBGraph, KBConfig, Cluster } from '../types';
import { NodeVisual } from '../components/NodeVisual';

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

    // 2. Convert markdown-generated <a href="node-id"> to hash-based graph navigation
    result = result.replace(
      /<a href="([^"#/][^"]*)">/g,
      (_match, target: string) => {
        if (nodeIds.has(target)) {
          return `<a href="#/node/${encodeURIComponent(target)}">`;
        }
        return `<a href="${target}">`;
      }
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

  return (
    <div className={styles.root}>
      {/* Hero image */}
      {showHero && (
        <NodeVisual node={node} mode={mode} surface="hero" source={source} />
      )}

      {/* Back link */}
      <div className={styles.backLink}>
        <Button appearance="subtle" icon={<ArrowLeftRegular />} as="a" href="#/">
          Home
        </Button>
      </div>

      {/* Header */}
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

      {/* Body: prose + connections */}
      <div className={`${styles.body} kb-reading-body`}>
        <div
          className="kb-prose"
          dangerouslySetInnerHTML={{ __html: linkifyContent(node.content) }}
        />

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
