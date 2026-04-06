import {
  makeStyles,
  tokens,
  Button,
  Title1,
  Subtitle2,
  Badge,
  Card,
  Caption1,
} from '@fluentui/react-components';
import {
  ArrowLeftRegular,
  ChevronLeftRegular,
  ChevronRightRegular,
} from '@fluentui/react-icons';
import type { KBGraph, KBConfig, KBNode, Cluster } from '../types';
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

function getClusterNodes(nodes: KBNode[], clusterId: string): KBNode[] {
  return nodes
    .filter(n => n.cluster === clusterId)
    .sort((a, b) => a.id.localeCompare(b.id));
}

const useStyles = makeStyles({
  root: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
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
    display: 'flex',
    flexDirection: 'column',
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
  navFooter: {
    marginTop: 'auto',
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    display: 'flex',
  },
  navLink: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingHorizontalXXS,
    textDecoration: 'none',
    color: 'inherit',
  },
  navLinkNext: {
    textAlign: 'right',
    alignItems: 'flex-end',
    borderLeft: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  navLinkDisabled: {
    pointerEvents: 'none',
    opacity: 0.3,
  },
  navTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
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

  if (!node) {
    return (
      <div className={styles.notFound}>
        <span style={{ fontSize: tokens.fontSizeHero800 }}>🔍</span>
        <Title1>Node not found</Title1>
        <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
          No node with id &quot;{nodeId}&quot; exists in this knowledge base.
        </Caption1>
        <Button appearance="subtle" icon={<ArrowLeftRegular />} as="a" href="#/">
          Back to overview
        </Button>
      </div>
    );
  }

  const mode = config.visuals.mode;
  const source = config.source;
  const cluster = findCluster(config, graph.clusters, node.cluster);

  // Connected nodes
  const relatedIds = graph.related[nodeId] ?? [];
  const connectionMap = new Map(
    node.connections.map(c => [c.to, c.description])
  );
  const connectedNodes = relatedIds
    .map(id => graph.nodes.find(n => n.id === id))
    .filter((n): n is KBNode => n != null);

  // Prev/next within cluster
  const clusterNodes = getClusterNodes(graph.nodes, node.cluster);
  const idx = clusterNodes.findIndex(n => n.id === nodeId);
  const prev = idx > 0 ? clusterNodes[idx - 1] : null;
  const next = idx < clusterNodes.length - 1 ? clusterNodes[idx + 1] : null;

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
          Back to overview
        </Button>
      </div>

      {/* Header */}
      <header className={`${styles.header} ${showHero ? styles.headerHero : ''}`}>
        <div className={styles.headerVisual}>
          {!showHero && (mode === 'sprites' && node.sprite) && (
            <NodeVisual node={node} mode={mode} surface="header" source={source} />
          )}
          {!showHero && mode === 'emoji' && node.emoji && (
            <NodeVisual node={node} mode="emoji" surface="header" source={source} />
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
          dangerouslySetInnerHTML={{ __html: node.content }}
        />

        {connectedNodes.length > 0 && (
          <aside className={`${styles.connectionsAside} kb-connections`}>
            <div className={styles.connectionsTitle}>
              <Subtitle2>Connected</Subtitle2>
              <Badge appearance="tint" size="small">{connectedNodes.length}</Badge>
            </div>
            <div className={styles.connectionsList}>
              {connectedNodes.map(cn => {
                const cnCluster = findCluster(config, graph.clusters, cn.cluster);
                const desc = connectionMap.get(cn.id) ?? '';
                return (
                  <a
                    key={cn.id}
                    href={`#/node/${encodeURIComponent(cn.id)}`}
                    className={styles.connectionCard}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <Card size="small" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: tokens.spacingHorizontalS, width: '100%' }}>
                      <NodeVisual
                        node={cn}
                        mode={mode}
                        surface="connection"
                        source={source}
                      />
                      <div className={styles.connectionInfo}>
                        <Caption1 className={styles.connectionTitle}>{cn.title}</Caption1>
                        {desc && <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{desc}</Caption1>}
                      </div>
                      <Badge
                        appearance="tint"
                        color="informative"
                        size="small"
                        className={styles.connectionPill}
                        icon={
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: cnCluster.color,
                              display: 'inline-block',
                            }}
                          />
                        }
                      >
                        {cnCluster.name}
                      </Badge>
                    </Card>
                  </a>
                );
              })}
            </div>
          </aside>
        )}
      </div>

      {/* Prev / Next */}
      <nav className={styles.navFooter}>
        <Button
          appearance="subtle"
          icon={<ChevronLeftRegular />}
          as="a"
          href={prev ? `#/node/${encodeURIComponent(prev.id)}` : undefined}
          className={`${styles.navLink} ${!prev ? styles.navLinkDisabled : ''}`}
          aria-disabled={!prev}
          style={{ flex: 1, justifyContent: 'flex-start' }}
        >
          <span className={styles.navTitle}>
            {prev?.emoji && <span>{prev.emoji}</span>}
            {prev?.title ?? '—'}
          </span>
        </Button>
        <Button
          appearance="subtle"
          icon={<ChevronRightRegular />}
          iconPosition="after"
          as="a"
          href={next ? `#/node/${encodeURIComponent(next.id)}` : undefined}
          className={`${styles.navLink} ${styles.navLinkNext} ${!next ? styles.navLinkDisabled : ''}`}
          aria-disabled={!next}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <span className={styles.navTitle}>
            {next?.emoji && <span>{next.emoji}</span>}
            {next?.title ?? '—'}
          </span>
        </Button>
      </nav>
    </div>
  );
}
