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
  /** When set, this node + its neighbors render at full opacity; others fade. */
  emphasizeNodeId?: string | null;
  /** Enable drag-to-pan and scroll-to-zoom (default: false) */
  interactive?: boolean;
}

export interface GraphNetworkResult {
  network: Network;
  nodes: DataSet<Record<string, unknown>>;
  edges: DataSet<Record<string, unknown>>;
  /** Dynamically update which node (and its neighborhood) is emphasized. Pass null to reset. */
  setEmphasis: (nodeId: string | null) => void;
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
  flagDisconnected?: boolean;
}

/** Important node IDs that get a size boost. */
const KEY_NODE_IDS = new Set(['readme', 'repo-root', 'overview', 'wiki-getting-started', 'wiki-deep-dive']);

/** Build a single vis-network node config using the custom renderer. */
export function buildVisNode(
  node: { id: string; title: string; cluster: string; emoji?: string },
  options: BuildVisNodeOptions,
): Record<string, unknown> {
  const [minSize, maxSize] = options.nodeSizeRange ?? [44, 64];
  const step = options.nodeSizeStep ?? 4;
  const maxLen = options.labelMaxLength ?? 25;

  const deg = options.degrees.get(node.id) ?? 0;
  const isKey = KEY_NODE_IDS.has(node.id);
  const baseSize = isKey ? minSize * 1.5 : minSize;
  const size = Math.min(baseSize + deg * step, isKey ? maxSize * 1.4 : maxSize);
  const color = options.clusterColorMap.get(node.cluster) ?? '#9A8A78';
  const showLabel = options.showLabel ?? true;
  const label = showLabel
    ? (node.title.length > maxLen ? node.title.substring(0, maxLen - 3) + '...' : node.title)
    : undefined;
  const disconnected = options.flagDisconnected && deg === 0;

  const result: Record<string, unknown> = {
    id: node.id,
    label: '',
    title: `${node.title}\n${deg} connection${deg === 1 ? '' : 's'}${disconnected ? '\n⚠ Disconnected node' : ''}`,
    shape: 'custom',
    ctxRenderer: createNodeRenderer(node.emoji, color, size, options.isDark, label, disconnected),
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
    emphasizeNodeId,
    interactive = false,
  } = options;

  const degrees = getNodeDegrees(graph);
  const clusterColorMap = new Map(graph.clusters.map(c => [c.id, c.color]));

  // Build set of emphasized node IDs (current + direct neighbors)
  const emphasizedIds = new Set<string>();
  if (emphasizeNodeId) {
    emphasizedIds.add(emphasizeNodeId);
    for (const edge of graph.edges) {
      if (edge.from === emphasizeNodeId) emphasizedIds.add(edge.to);
      if (edge.to === emphasizeNodeId) emphasizedIds.add(edge.from);
    }
  }

  const nodeData = graph.nodes.map(n => {
    const faded = emphasizeNodeId && !emphasizedIds.has(n.id);
    const sizeRange: [number, number] = faded
      ? [nodeSizeRange[0] * 0.6, nodeSizeRange[1] * 0.6]
      : nodeSizeRange;
    return buildVisNode(n, {
      degrees, clusterColorMap, isDark,
      nodeSizeRange: sizeRange, nodeSizeStep, labelMaxLength,
      flagDisconnected: true,
      opacity: faded ? 0.15 : undefined,
      showLabel: !faded,
    });
  });

  const EDGE_FADED_COLOR = 'rgba(80,80,80,0.08)';

  const baseSpringLength = 250;
  const edgeData = graph.edges.map((e, i) => {
    const faded = emphasizeNodeId && !emphasizedIds.has(e.from) && !emphasizedIds.has(e.to);
    // An edge touching the neighborhood is "near" — only fully bright if both ends are in the set
    const nearFaded = emphasizeNodeId && !(emphasizedIds.has(e.from) && emphasizedIds.has(e.to));
    return {
      id: `e${i}`,
      from: e.from,
      to: e.to,
      title: e.description,
      color: {
        color: faded ? EDGE_FADED_COLOR : nearFaded ? 'rgba(80,80,80,0.25)' : EDGE_COLOR,
        hover: EDGE_HOVER_COLOR,
        highlight: EDGE_HOVER_COLOR,
      },
      width: faded ? 0.5 : edgeWidth,
      dashes: edgeDashes,
      length: e.weight ? baseSpringLength / e.weight : baseSpringLength,
    };
  });

  const nodes = new DataSet(nodeData);
  const edges = new DataSet(edgeData);

  // Build an edge lookup for fast emphasis updates
  const edgesByIndex = graph.edges.map((e, i) => ({ id: `e${i}`, from: e.from, to: e.to }));

  /** Dynamically update neighborhood emphasis without rebuilding the network. */
  const setEmphasis = (nodeId: string | null) => {
    const newEmphasized = new Set<string>();
    if (nodeId) {
      newEmphasized.add(nodeId);
      for (const edge of graph.edges) {
        if (edge.from === nodeId) newEmphasized.add(edge.to);
        if (edge.to === nodeId) newEmphasized.add(edge.from);
      }
    }

    // Update nodes
    const nodeUpdates: Record<string, unknown>[] = [];
    for (const n of graph.nodes) {
      const faded = nodeId && !newEmphasized.has(n.id);
      const sizeRange: [number, number] = faded
        ? [nodeSizeRange[0] * 0.6, nodeSizeRange[1] * 0.6]
        : nodeSizeRange;
      nodeUpdates.push(buildVisNode(n, {
        degrees, clusterColorMap, isDark,
        nodeSizeRange: sizeRange, nodeSizeStep, labelMaxLength,
        flagDisconnected: true,
        opacity: faded ? 0.15 : undefined,
        showLabel: !faded,
      }));
    }
    nodes.update(nodeUpdates);

    // Update edges
    const edgeUpdates: Record<string, unknown>[] = [];
    for (const ei of edgesByIndex) {
      const bothIn = newEmphasized.has(ei.from) && newEmphasized.has(ei.to);
      const neitherIn = nodeId && !newEmphasized.has(ei.from) && !newEmphasized.has(ei.to);
      edgeUpdates.push({
        id: ei.id,
        color: {
          color: neitherIn ? EDGE_FADED_COLOR : !bothIn && nodeId ? 'rgba(80,80,80,0.25)' : EDGE_COLOR,
          hover: EDGE_HOVER_COLOR,
          highlight: EDGE_HOVER_COLOR,
        },
        width: neitherIn ? 0.5 : edgeWidth,
      });
    }
    edges.update(edgeUpdates);

    // DataSet updates can re-trigger physics — kill it immediately
    network.setOptions({ physics: { enabled: false } });
  };

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
        gravitationalConstant: -120,
        centralGravity: 0.01,
        springLength: 200,
        springConstant: 0.04,
        damping: 0.6,
      },
      stabilization: { enabled: true, iterations: 500, updateInterval: 100 },
    },
    interaction: {
      hover: true,
      tooltipDelay: 200,
      navigationButtons: false,
      keyboard: false,
      dragView: interactive,
      zoomView: interactive,
      zoomSpeed: 0.3,
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

  // Belt-and-suspenders: also kill physics on iteration done
  network.on('stabilizationIterationsDone', () => {
    network.setOptions({ physics: { enabled: false } });
  });

  network.once('stabilized', () => {
    // Kill physics immediately — no more drifting
    network.setOptions({ physics: { enabled: false } });

    // Compute bounding box of all nodes for pan clamping
    const allPositions = network.getPositions();
    const posArray = Object.values(allPositions) as { x: number; y: number }[];
    if (posArray.length === 0) return;

    const pad = 120; // padding around the graph bounds
    let bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity;
    for (const p of posArray) {
      if (p.x < bMinX) bMinX = p.x;
      if (p.x > bMaxX) bMaxX = p.x;
      if (p.y < bMinY) bMinY = p.y;
      if (p.y > bMaxY) bMaxY = p.y;
    }
    bMinX -= pad; bMinY -= pad; bMaxX += pad; bMaxY += pad;

    const bCenterX = (bMinX + bMaxX) / 2;
    const bCenterY = (bMinY + bMaxY) / 2;
    const bW = bMaxX - bMinX;
    const bH = bMaxY - bMinY;

    /** Clamp a graph-space position to the pan bounds at the given scale. */
    const clamp = (gx: number, gy: number, scale: number) => {
      const halfViewW = container.clientWidth / scale / 2;
      const halfViewH = container.clientHeight / scale / 2;
      const cx = bW <= halfViewW * 2
        ? bCenterX
        : Math.max(bMinX + halfViewW, Math.min(bMaxX - halfViewW, gx));
      const cy = bH <= halfViewH * 2
        ? bCenterY
        : Math.max(bMinY + halfViewH, Math.min(bMaxY - halfViewH, gy));
      return { x: cx, y: cy };
    };

    // --- Custom bounded panning (replaces dragView) ---
    let isPanning = false;
    let panStartScreenX = 0;
    let panStartScreenY = 0;
    let panStartViewX = 0;
    let panStartViewY = 0;

    const canvas = container.querySelector('canvas') as HTMLCanvasElement | null;
    if (canvas) {
      canvas.addEventListener('pointerdown', (e: PointerEvent) => {
        // Only pan on primary button + empty area (not on nodes)
        if (e.button !== 0) return;
        const nodeAt = network.getNodeAt({ x: e.offsetX, y: e.offsetY });
        if (nodeAt) return; // let vis-network handle node dragging
        isPanning = true;
        panStartScreenX = e.clientX;
        panStartScreenY = e.clientY;
        const vp = network.getViewPosition();
        panStartViewX = vp.x;
        panStartViewY = vp.y;
        canvas.setPointerCapture(e.pointerId);
      });

      canvas.addEventListener('pointermove', (e: PointerEvent) => {
        if (!isPanning) return;
        const scale = network.getScale();
        const dx = (e.clientX - panStartScreenX) / scale;
        const dy = (e.clientY - panStartScreenY) / scale;
        const target = clamp(panStartViewX - dx, panStartViewY - dy, scale);
        network.moveTo({ position: target, animation: false });
      });

      const endPan = () => { isPanning = false; };
      canvas.addEventListener('pointerup', endPan);
      canvas.addEventListener('pointercancel', endPan);
    }

    // Clamp on zoom (scroll wheel)
    network.on('zoom', () => {
      const { x, y } = network.getViewPosition();
      const scale = network.getScale();
      const clamped = clamp(x, y, scale);
      if (Math.abs(clamped.x - x) > 0.5 || Math.abs(clamped.y - y) > 0.5) {
        network.moveTo({ position: clamped, animation: false });
      }
    });

    // Initial view: focus on node (clamped) or fit all
    if (focusNodeId && nodes.get(focusNodeId)) {
      network.fit({ animation: false });
      network.selectNodes([focusNodeId]);
      const pos = allPositions[focusNodeId] as { x: number; y: number } | undefined;
      if (pos) {
        const scale = interactive ? 1.0 : 1.0;
        const target = clamp(pos.x, pos.y, scale);
        network.moveTo({
          position: target,
          scale,
          animation: { duration: 50, easingFunction: 'easeInOutQuad' },
        });
      }
    } else if (fitOnStabilize) {
      network.fit({
        animation: { duration: 50, easingFunction: 'easeInOutQuad' },
        maxZoomLevel: 2.0,
      });
    }
  });

  return { network, nodes, edges, setEmphasis };
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
        gravitationalConstant: -120,
        centralGravity: 0.01,
        springLength: 200,
        springConstant: 0.04,
        damping: 0.6,
      },
      stabilization: { iterations: 150 },
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
