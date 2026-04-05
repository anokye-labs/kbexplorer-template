import {
  Title1,
  Subtitle2,
  Caption1,
  Body1,
  Body1Strong,
  Card,
  CardHeader,
  Badge,
  CounterBadge,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import type { KBGraph, KBConfig, KBNode, Cluster } from '../types';
import { NodeVisual } from '../components/NodeVisual';

export interface OverviewViewProps {
  graph: KBGraph;
  config: KBConfig;
}

/** Group nodes by cluster id, preserving cluster ordering. */
function groupByCluster(
  nodes: KBNode[],
  clusters: Cluster[]
): { cluster: Cluster; nodes: KBNode[] }[] {
  const map = new Map<string, KBNode[]>();
  for (const node of nodes) {
    const list = map.get(node.cluster) ?? [];
    list.push(node);
    map.set(node.cluster, list);
  }
  return clusters
    .filter(c => map.has(c.id))
    .map(cluster => ({ cluster, nodes: map.get(cluster.id)! }));
}

const useStyles = makeStyles({
  root: {
    paddingTop: tokens.spacingVerticalXXL,
    paddingBottom: tokens.spacingVerticalXXL,
    paddingLeft: tokens.spacingHorizontalXXL,
    paddingRight: tokens.spacingHorizontalXXL,
    maxWidth: '1200px',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  title: {
    display: 'block',
    marginBottom: tokens.spacingVerticalS,
  },
  subtitle: {
    display: 'block',
    color: tokens.colorNeutralForeground3,
    marginBottom: tokens.spacingVerticalS,
  },
  stats: {
    display: 'block',
    color: tokens.colorNeutralForeground3,
    marginBottom: tokens.spacingVerticalXXL,
  },
  cluster: {
    marginBottom: tokens.spacingVerticalXXL,
  },
  clusterHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalM,
  },
  clusterDot: {
    width: '10px',
    height: '10px',
    borderRadius: tokens.borderRadiusCircular,
    flexShrink: 0,
    display: 'inline-block',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: tokens.spacingHorizontalL,
    '@media (max-width: 768px)': {
      gridTemplateColumns: '1fr',
    },
  },
  card: {
    cursor: 'pointer',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
  },
  cardInner: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
    minWidth: 0,
    flex: 1,
  },
  cardTitle: {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
});

export function OverviewView({ graph, config }: OverviewViewProps) {
  const classes = useStyles();
  const groups = groupByCluster(graph.nodes, graph.clusters);

  return (
    <div className={classes.root}>
      <Title1 as="h1" className={classes.title}>{config.title}</Title1>
      {config.subtitle && (
        <Body1 className={classes.subtitle}>{config.subtitle}</Body1>
      )}
      <Caption1 className={classes.stats} as="p">
        {graph.nodes.length} nodes · {graph.edges.length} edges · {graph.clusters.length} clusters
      </Caption1>

      {groups.map(({ cluster, nodes }) => (
        <section key={cluster.id} className={classes.cluster}>
          <div className={classes.clusterHeader}>
            <span
              className={classes.clusterDot}
              style={{ background: cluster.color }}
            />
            <Subtitle2>{cluster.name}</Subtitle2>
          </div>

          <div className={classes.grid}>
            {nodes.map(node => (
              <Card
                key={node.id}
                appearance="filled-alternative"
                className={classes.card}
                onClick={() => {
                  window.location.hash = `#/node/${encodeURIComponent(node.id)}`;
                }}
              >
                <CardHeader
                  image={
                    <NodeVisual
                      node={node}
                      mode={config.visuals.mode}
                      surface="card"
                      source={config.source}
                    />
                  }
                  header={
                    <Body1Strong className={classes.cardTitle}>
                      {node.title}
                    </Body1Strong>
                  }
                  description={
                    <div className={classes.cardMeta}>
                      {node.connections.length > 0 && (
                        <CounterBadge
                          count={node.connections.length}
                          appearance="filled"
                          color="informative"
                          size="small"
                        />
                      )}
                      <Badge
                        appearance="tint"
                        color="informative"
                        size="small"
                      >
                        {cluster.name}
                      </Badge>
                    </div>
                  }
                />
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
