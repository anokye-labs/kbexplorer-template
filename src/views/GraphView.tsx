import { useEffect, useRef, useState, useCallback } from 'react';
import type { DataSet } from 'vis-data';
import {
  makeStyles,
  tokens,
  Button,
  Card,
  CardHeader,
  Badge,
  Caption1,
} from '@fluentui/react-components';
import { ArrowLeftRegular } from '@fluentui/react-icons';
import type { KBGraph, KBConfig } from '../types';
import { getNodeDegrees } from '../engine/graph';
import { createGraphNetwork, buildVisNode } from '../engine/createGraphNetwork';

interface GraphViewProps {
  graph: KBGraph;
  config: KBConfig;
}

const useStyles = makeStyles({
  container: {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    backgroundColor: tokens.colorNeutralBackground1,
    zIndex: 1,
  },
  canvas: {
    width: '100%',
    height: '100%',
  },
  backButton: {
    position: 'absolute',
    top: tokens.spacingVerticalL,
    left: tokens.spacingHorizontalL,
    zIndex: 10,
  },
  legend: {
    position: 'absolute',
    bottom: tokens.spacingVerticalL,
    left: tokens.spacingHorizontalL,
    zIndex: 10,
    minWidth: '140px',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalSNudge,
    padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalSNudge}`,
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
    userSelect: 'none',
    transitionProperty: 'background',
    transitionDuration: '0.15s',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  legendItemActive: {
    backgroundColor: tokens.colorNeutralBackground1Selected,
  },
});

export default function GraphView({ graph, config }: GraphViewProps) {
  const styles = useStyles();
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<DataSet<Record<string, unknown>> | null>(null);
  const [activeCluster, setActiveCluster] = useState<string | null>(null);

  const clusterColorMap = new Map(
    graph.clusters.map(c => [c.id, c.color]),
  );

  const degrees = getNodeDegrees(graph);

  const handleClusterClick = useCallback(
    (clusterId: string) => {
      const next = activeCluster === clusterId ? null : clusterId;
      setActiveCluster(next);

      const ds = nodesRef.current;
      if (!ds) return;

      if (!next) {
        ds.update(graph.nodes.map(n =>
          buildVisNode(n, { degrees, clusterColorMap, isDark: true }),
        ));
        return;
      }

      ds.update(graph.nodes.map(n => {
        const inCluster = n.cluster === next;
        return buildVisNode(n, {
          degrees,
          clusterColorMap,
          isDark: true,
          opacity: inCluster ? 1 : 0.15,
          showLabel: inCluster,
        });
      }));
    },
    [activeCluster, graph, degrees, clusterColorMap],
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const { network, nodes } = createGraphNetwork({
      container: containerRef.current,
      graph,
      isDark: true,
      onNodeClick: (id) => {
        window.location.hash = `/node/${encodeURIComponent(id)}`;
      },
    });

    nodesRef.current = nodes;

    return () => {
      network.destroy();
      nodesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, config]);

  return (
    <div className={styles.container}>
      <div className={styles.backButton}>
        <Button appearance="subtle" icon={<ArrowLeftRegular />} as="a" href="#/">
          Overview
        </Button>
      </div>

      <div ref={containerRef} className={styles.canvas} />

      <Card className={styles.legend} size="small" style={{ maxHeight: '400px', overflowY: 'auto' }}>
        <CardHeader header={<Caption1><strong>Clusters</strong></Caption1>} />
        {graph.clusters.map(c => (
          <div
            key={c.id}
            className={`${styles.legendItem} ${activeCluster === c.id ? styles.legendItemActive : ''}`}
            onClick={() => handleClusterClick(c.id)}
          >
            <Badge
              appearance="filled"
              size="tiny"
              color="brand"
              style={{ backgroundColor: c.color, minWidth: 10, width: 10, height: 10 }}
            />
            <Caption1>{c.name}</Caption1>
          </div>
        ))}
      </Card>
    </div>
  );
}
