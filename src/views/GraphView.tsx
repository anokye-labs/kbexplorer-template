import { useEffect, useRef, useState, useCallback } from 'react';
import { Network } from 'vis-network/standalone';
import { DataSet } from 'vis-data';
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
import { getVisNodeConfig } from '../components/NodeVisual';
import { getNodeDegrees } from '../engine/graph';

interface GraphViewProps {
  graph: KBGraph;
  config: KBConfig;
}

// Fluent 2 dark-theme hex values for vis-network (not React components)
const LABEL_COLOR = '#d6d6d6';       // colorNeutralForeground2
const LABEL_STROKE_COLOR = '#1f1f1f'; // colorNeutralBackground1
const EDGE_COLOR = '#383838';         // colorNeutralStroke2
const EDGE_HOVER_COLOR = '#5c5c5c';   // colorNeutralStroke1Hover
const FONT_FAMILY = `'Segoe UI', 'Segoe UI Web (West European)', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', sans-serif`;

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
    top: '20px',
    left: '20px',
    zIndex: 10,
  },
  legend: {
    position: 'absolute',
    bottom: '20px',
    left: '20px',
    zIndex: 10,
    minWidth: '140px',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalSNudge,
    padding: '4px 6px',
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
  const networkRef = useRef<Network | null>(null);
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
        const updates = graph.nodes.map(n => {
          const deg = degrees.get(n.id) ?? 0;
          const size = Math.min(20 + deg * 5, 50);
          const color = clusterColorMap.get(n.cluster) ?? '#9A8A78';
          return {
            id: n.id,
            opacity: 1,
            ...getVisNodeConfig(n, config.visuals.mode, config.source, color, size),
            label: n.title,
            font: { color: LABEL_COLOR, face: FONT_FAMILY, size: 12 },
          };
        });
        ds.update(updates);
        return;
      }

      const updates = graph.nodes.map(n => {
        const inCluster = n.cluster === next;
        const deg = degrees.get(n.id) ?? 0;
        const size = Math.min(20 + deg * 5, 50);
        const color = clusterColorMap.get(n.cluster) ?? '#9A8A78';
        return {
          id: n.id,
          opacity: inCluster ? 1 : 0.15,
          ...getVisNodeConfig(n, config.visuals.mode, config.source, color, size),
          label: n.title,
          font: {
            color: inCluster ? LABEL_COLOR : 'rgba(214,214,214,0.15)',
            face: FONT_FAMILY,
            size: 12,
          },
        };
      });
      ds.update(updates);
    },
    [activeCluster, graph, config, degrees, clusterColorMap],
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const nodeData = graph.nodes.map(n => {
      const deg = degrees.get(n.id) ?? 0;
      const size = Math.min(20 + deg * 5, 50);
      const color = clusterColorMap.get(n.cluster) ?? '#9A8A78';
      const visConfig = getVisNodeConfig(n, config.visuals.mode, config.source, color, size);

      return {
        id: n.id,
        label: n.title,
        title: `${n.title}\n${deg} connection${deg === 1 ? '' : 's'}`,
        font: { color: LABEL_COLOR, face: FONT_FAMILY, size: 12, strokeWidth: 3, strokeColor: LABEL_STROKE_COLOR },
        ...visConfig,
      };
    });

    const edgeData = graph.edges.map((e, i) => ({
      id: `e${i}`,
      from: e.from,
      to: e.to,
      title: e.description,
      color: { color: EDGE_COLOR, hover: EDGE_HOVER_COLOR, highlight: EDGE_HOVER_COLOR },
      width: 1.5,
      dashes: [4, 6],
    }));

    const nodes = new DataSet(nodeData);
    const edges = new DataSet(edgeData);
    nodesRef.current = nodes;

    const network = new Network(containerRef.current, { nodes, edges }, {
      physics: {
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -120,
          centralGravity: 0.008,
          springLength: 180,
          springConstant: 0.04,
          damping: 0.4,
        },
        stabilization: { iterations: 250 },
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        navigationButtons: false,
        keyboard: false,
      },
      edges: {
        smooth: { enabled: true, type: 'continuous', roundness: 0.5 },
      },
    });

    network.on('click', (params: { nodes: string[] }) => {
      if (params.nodes.length > 0) {
        window.location.hash = `/node/${encodeURIComponent(params.nodes[0])}`;
      }
    });

    networkRef.current = network;

    return () => {
      network.destroy();
      networkRef.current = null;
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

      <Card className={styles.legend} size="small">
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
