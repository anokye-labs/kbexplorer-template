/**
 * Shared vis-network graph factory — single source of truth for node mapping,
 * edge mapping, physics config, and stabilization behavior.
 */
import { Network } from 'vis-network/standalone';
import { DataSet } from 'vis-data';
import { createNodeRenderer } from './nodeRenderer';
import { getNodeDegrees } from './graph';
import type { KBGraph } from '../types';

const EDGE_COLOR = '#505050';
const EDGE_HOVER_COLOR = '#5c5c5c';

export interface GraphNetworkOptions {
  container: HTMLElement;
  graph: KBGraph;
  isDark: boolean;
  onNodeClick?: (nodeId: string) => void;
  focusNodeId?: string | null;
  fitOnStabilize?: boolean;
  nodeSizeRange?: [number, number];
  nodeSizeStep?: number;
  labelMaxLength?: number;
  edgeWidth?: number;
  edgeDashes?: boolean | number[];
}

export interface GraphNetworkResult {
  network: Network;
  nodes: DataSet<Record<string, unknown>>;
  edges: DataSet<Record<string, unknown>>;
}

export interface BuildVisNodeOptions {
  degrees: Map<string, number>;
  clusterColorMap: Map<string, string>;
  isDark: boolean;
  nodeSizeRange?: [number, number];
  nodeSizeStep?: number;
  labelMaxLength?: number;
  opacity?: number;
  showLabel?: boolean;
}

/** Build a single vis-network node config using the custom renderer. */
export function buildVisNode(
  node: { id: string; title: string; cluster: string; emoji?: string },
  options: BuildVisNodeOptions,
): Record<string, unknown> {
  const [minSize, maxSize] = options.nodeSizeRange ?? [44, 64];
  const step = options.nodeSizeStep ?? 4;
  const maxLen = options.labelMaxLength ?? 25;

  const deg = options.degrees.get(node.id) ?? 0;
  const size = Math.min(minSize + deg * step, maxSize);
  const color = options.clusterColorMap.get(node.cluster) ?? '#9A8A78';
  const showLabel = options.showLabel ?? true;
  const label = showLabel
    ? (node.title.length > maxLen ? node.title.substring(0, maxLen - 3) + '...' : node.title)
    : undefined;

  const result: Record<string, unknown> = {
    id: node.id,
    label: '',
    title: `${node.title}\n${deg} connection${deg === 1 ? '' : 's'}`,
    shape: 'custom',
    ctxRenderer: createNodeRenderer(node.emoji, color, size, options.isDark, label),
    size: size / 2,
  };

  if (options.opacity != null) {
    result.opacity = options.opacity;
  }

  return result;
}

/** Create a fully configured vis-network graph instance. */
export function createGraphNetwork(options: GraphNetworkOptions): GraphNetworkResult {
  const {
    container,
    graph,
    isDark,
    onNodeClick,
    focusNodeId,
    fitOnStabilize = false,
    nodeSizeRange = [44, 64],
    nodeSizeStep = 4,
    labelMaxLength = 25,
    edgeWidth = 2,
    edgeDashes = false,
  } = options;

  const degrees = getNodeDegrees(graph);
  const clusterColorMap = new Map(graph.clusters.map(c => [c.id, c.color]));

  const nodeData = graph.nodes.map(n =>
    buildVisNode(n, { degrees, clusterColorMap, isDark, nodeSizeRange, nodeSizeStep, labelMaxLength }),
  );

  const edgeData = graph.edges.map((e, i) => ({
    id: `e${i}`,
    from: e.from,
    to: e.to,
    title: e.description,
    color: { color: EDGE_COLOR, hover: EDGE_HOVER_COLOR, highlight: EDGE_HOVER_COLOR },
    width: edgeWidth,
    dashes: edgeDashes,
  }));

  const nodes = new DataSet(nodeData);
  const edges = new DataSet(edgeData);

  const network = new Network(container, { nodes, edges }, {
    nodes: {
      scaling: {
        label: { enabled: true, min: 8, max: 14, drawThreshold: 5 },
      },
      font: { vadjust: 45 },
    },
    physics: {
      solver: 'forceAtlas2Based',
      forceAtlas2Based: {
        gravitationalConstant: -160,
        centralGravity: 0.005,
        springLength: 250,
        springConstant: 0.03,
        damping: 0.4,
      },
      stabilization: { iterations: 300 },
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

  if (onNodeClick) {
    network.on('click', (params: { nodes: string[] }) => {
      if (params.nodes.length > 0) {
        onNodeClick(params.nodes[0]);
      }
    });
  }

  if (focusNodeId || fitOnStabilize) {
    network.once('stabilized', () => {
      if (focusNodeId && nodes.get(focusNodeId)) {
        network.fit({ animation: false });
        network.selectNodes([focusNodeId]);
        network.focus(focusNodeId, {
          scale: 1.0,
          animation: { duration: 400, easingFunction: 'easeInOutQuad' },
        });
      } else if (fitOnStabilize) {
        network.fit({
          animation: { duration: 400, easingFunction: 'easeInOutQuad' },
        });
      }
    });
  }

  return { network, nodes, edges };
}

/**
 * Compute graph layout positions using a lightweight hidden vis-network.
 * Calls `onComplete` with the position map once stabilized, then self-destructs.
 * Returns a cleanup function for React effects.
 */
export function computeGraphPositions(
  graph: KBGraph,
  onComplete: (positions: Map<string, { x: number; y: number }>) => void,
): () => void {
  const tempDiv = document.createElement('div');
  tempDiv.style.cssText = 'position:absolute;left:-9999px;width:400px;height:280px;';
  document.body.appendChild(tempDiv);

  const degrees = getNodeDegrees(graph);
  const clusterColorMap = new Map(graph.clusters.map(c => [c.id, c.color]));

  const nodeData = graph.nodes.map(n => {
    const deg = degrees.get(n.id) ?? 0;
    const size = Math.min(10 + deg * 3, 30);
    const color = clusterColorMap.get(n.cluster) ?? '#888';
    return { id: n.id, label: '', size, color: { background: color + '88', border: color }, borderWidth: 1 };
  });

  const edgeData = graph.edges.map((e, i) => ({ id: `e${i}`, from: e.from, to: e.to }));

  const nodes = new DataSet(nodeData);
  const edges = new DataSet(edgeData);

  const net = new Network(tempDiv, { nodes, edges }, {
    physics: {
      solver: 'forceAtlas2Based',
      forceAtlas2Based: {
        gravitationalConstant: -40,
        centralGravity: 0.02,
        springLength: 60,
        springConstant: 0.08,
        damping: 0.5,
      },
      stabilization: { iterations: 200 },
    },
    interaction: { dragNodes: false, zoomView: false, dragView: false },
  });

  let destroyed = false;

  net.once('stabilized', () => {
    if (destroyed) return;
    const positions = net.getPositions();
    const posMap = new Map<string, { x: number; y: number }>();
    for (const [id, pos] of Object.entries(positions)) {
      posMap.set(id, pos as { x: number; y: number });
    }
    net.destroy();
    document.body.removeChild(tempDiv);
    destroyed = true;
    onComplete(posMap);
  });

  return () => {
    if (!destroyed) {
      try { net.destroy(); } catch { /* already destroyed */ }
      try { document.body.removeChild(tempDiv); } catch { /* already removed */ }
      destroyed = true;
    }
  };
}
