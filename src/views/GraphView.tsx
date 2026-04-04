import { useEffect, useRef, useState, useCallback } from 'react';
import { Network } from 'vis-network/standalone';
import { DataSet } from 'vis-data';
import type { KBGraph, KBConfig } from '../types';
import { getVisNodeConfig } from '../components/NodeVisual';
import { getNodeDegrees } from '../engine/graph';
import '../styles/graph.css';

interface GraphViewProps {
  graph: KBGraph;
  config: KBConfig;
}

export default function GraphView({ graph, config }: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  // Keep a ref to the nodes DataSet so we can update it from the cluster filter
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
            font: { color: '#C8B8A8', face: 'General Sans', size: 12 },
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
            color: inCluster ? '#C8B8A8' : 'rgba(200,184,168,0.15)',
            face: 'General Sans',
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
        font: { color: '#C8B8A8', face: 'General Sans, sans-serif', size: 12, strokeWidth: 3, strokeColor: '#0D0D0D' },
        ...visConfig,
      };
    });

    const edgeData = graph.edges.map((e, i) => ({
      id: `e${i}`,
      from: e.from,
      to: e.to,
      title: e.description,
      color: { color: '#2A2620', hover: '#4A4438', highlight: '#4A4438' },
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
    <div className="graph-container">
      <a className="graph-back" href="#/">
        ← Overview
      </a>

      <div ref={containerRef} className="graph-canvas" />

      <div className="graph-legend">
        <div className="graph-legend-title">Clusters</div>
        {graph.clusters.map(c => (
          <div
            key={c.id}
            className={`graph-legend-item${activeCluster === c.id ? ' graph-legend-item--active' : ''}`}
            onClick={() => handleClusterClick(c.id)}
          >
            <span className="graph-legend-dot" style={{ background: c.color }} />
            {c.name}
          </div>
        ))}
      </div>
    </div>
  );
}
