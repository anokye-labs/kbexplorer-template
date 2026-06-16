/**
 * Shared vis-network graph factory — single source of truth for node mapping,
 * edge mapping, physics config, and stabilization behavior.
 */
import { Network } from 'vis-network/standalone';
import { DataSet } from 'vis-data';
import { createNodeRenderer } from './nodeRenderer';
import { getNodeDegrees } from './graph';
import { computeReportsToLevels } from './reports-to-layout';
import type { KBGraph, GraphLayoutMode } from '../types';
import { getEdgeStyle } from '../types';

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
  /**
   * Layout strategy. `'force'` (default) is the force-directed constellation;
   * `'reports-to'` renders a hierarchical org tree where managers sit above
   * their reports, levels computed from the `reports-to` relation (#279).
   */
  layout?: GraphLayoutMode;
  /**
   * Slot label for the audit hook (`window.__kbeNetworks[slot]`). Used by
   * `scripts/audit-visual.mjs` and devtools to find the live network. If
   * omitted, no audit registration occurs.
   */
  auditSlot?: string;
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
  keyNodeIds?: Set<string>;
  /**
   * Minimum degree a node must have to be given a (non-empty) label. Nodes
   * below this — and not in `keyNodeIds` — are built with `label: ''`, so the
   * custom renderer paints no text for them. This gates whether a label exists
   * at all (the LOD that declutters the constellation), not zoom behaviour.
   */
  labelDegreeThreshold?: number;
}

/**
 * Compute important node IDs dynamically — top nodes by degree in the
 * current graph get a size boost. Works across any layer filter.
 */
function computeKeyNodes(degrees: Map<string, number>, count: number = 8): Set<string> {
  const sorted = [...degrees.entries()].sort((a, b) => b[1] - a[1]);
  return new Set(sorted.slice(0, count).filter(([, d]) => d >= 2).map(([id]) => id));
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
  const isKey = options.keyNodeIds?.has(node.id) ?? false;
  const baseSize = isKey ? minSize * 1.5 : minSize;
  const size = Math.min(baseSize + deg * step, isKey ? maxSize * 1.4 : maxSize);
  const color = options.clusterColorMap.get(node.cluster) ?? '#9A8A78';
  // LOD: only show label when explicitly enabled AND the node is prominent enough.
  // Key nodes and nodes above the degree threshold are always labelled.
  // Other nodes suppress their label so the canvas isn't a wall of micro-text.
  const labelDegThreshold = options.labelDegreeThreshold ?? 2;
  const labelEligible = isKey || deg >= labelDegThreshold;
  const showLabel = (options.showLabel ?? true) && labelEligible;
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
    // Audit sidecar: the rendered label is captured inside the ctxRenderer
    // closure and isn't visible through vis-network's public DataSet API.
    // We mirror it here so `scripts/audit-visual.mjs` can assert label
    // coverage without re-running OCR on the canvas pixels. Empty string
    // means the renderer is configured to paint no text for this node.
    __auditLabel: label ?? '',
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
    nodeSizeStep = 4,
    labelMaxLength = 25,
    emphasizeNodeId,
    interactive = false,
    layout = 'force',
    auditSlot,
  } = options;

  const hierarchical = layout === 'reports-to';
  // Per-node tree depth for the hierarchical org layout. Empty in force mode.
  const reportsToLevels = hierarchical ? computeReportsToLevels(graph) : null;

  // Adaptive node sizing — large graphs need smaller nodes so the labels stay
  // proportional and the canvas doesn't turn into a sea of overlapping bubbles.
  // Was a fixed [44, 64] for every graph, which left 800-node constellations
  // looking like a wall of touching circles with little visible label area.
  const totalNodes = graph.nodes.length;
  const adaptiveDefault: [number, number] = totalNodes > 600
    ? [22, 36]
    : totalNodes > 200
      ? [28, 44]
      : totalNodes > 80
        ? [34, 52]
        : [44, 64];
  const nodeSizeRange = options.nodeSizeRange ?? adaptiveDefault;

  const degrees = getNodeDegrees(graph);
  const clusterColorMap = new Map(graph.clusters.map(c => [c.id, c.color]));
  const keyNodeIds = computeKeyNodes(degrees);

  // Build set of emphasized node IDs (current + direct neighbors)
  // Skip emphasis if the target node isn't in this graph (e.g. layer filtered out)
  const nodeIdSet = new Set(graph.nodes.map(n => n.id));
  const effectiveEmphasis = emphasizeNodeId && nodeIdSet.has(emphasizeNodeId) ? emphasizeNodeId : null;
  const emphasizedIds = new Set<string>();
  if (effectiveEmphasis) {
    emphasizedIds.add(effectiveEmphasis);
    for (const edge of graph.edges) {
      if (edge.from === effectiveEmphasis) emphasizedIds.add(edge.to);
      if (edge.to === effectiveEmphasis) emphasizedIds.add(edge.from);
    }
  }

  // Soften emphasis for small graphs — show more context when fewer nodes
  const nodeCount = graph.nodes.length;
  const fadedOpacity = nodeCount < 30 ? 0.5 : nodeCount < 60 ? 0.3 : 0.15;
  const fadedSizeScale = nodeCount < 30 ? 0.85 : nodeCount < 60 ? 0.7 : 0.6;
  const showFadedLabels = nodeCount < 40;

  const nodeData = graph.nodes.map(n => {
    const faded = effectiveEmphasis && !emphasizedIds.has(n.id);
    const sizeRange: [number, number] = faded
      ? [nodeSizeRange[0] * fadedSizeScale, nodeSizeRange[1] * fadedSizeScale]
      : nodeSizeRange;
    const visNode = buildVisNode(n, {
      degrees, clusterColorMap, isDark, keyNodeIds,
      nodeSizeRange: sizeRange, nodeSizeStep, labelMaxLength,
      flagDisconnected: true,
      opacity: faded ? fadedOpacity : undefined,
      showLabel: faded ? showFadedLabels : true,
      // Always label direct neighbours of the focused node — without this
      // override low-degree neighbours render as unlabelled "mystery circles"
      // because the global label threshold (degree ≥ 2) hides them.
      labelDegreeThreshold: effectiveEmphasis && emphasizedIds.has(n.id) ? 0 : undefined,
    });
    // Hierarchical org layout positions nodes by their reporting depth.
    if (reportsToLevels) visNode.level = reportsToLevels.get(n.id) ?? 0;
    return visNode;
  });

  // Slightly brighter faded edge tone — the previous rgba(80,80,80,0.08) made
  // off-neighbourhood edges effectively invisible on the dark theme, which the
  // user flagged as "links between nodes are too hard to see".
  const EDGE_FADED_COLOR = isDark ? 'rgba(160,160,160,0.18)' : 'rgba(80,80,80,0.18)';

  /** Resolve the visual style for an edge type */
  /** Resolve the visual style for an edge (relation-aware, data-driven). */
  const edgeStyle = (e: { type?: string; relation?: string }) => getEdgeStyle(e);

  const baseSpringLength = 220;
  // Inferred edges (auto-created to anchor orphan nodes to cluster siblings)
  // get a shorter spring so they don't scatter to the periphery (#252).
  const inferredSpringLength = 120;
  const edgeData = graph.edges.map((e, i) => {
    const style = edgeStyle(e);
    const faded = effectiveEmphasis && !emphasizedIds.has(e.from) && !emphasizedIds.has(e.to);
    const nearFaded = effectiveEmphasis && !(emphasizedIds.has(e.from) && emphasizedIds.has(e.to));
    const springBase = e.source === 'inferred' ? inferredSpringLength : baseSpringLength;
    // In the hierarchical org tree, render edges manager→report (parent→child)
    // so vis-network routes them downward. Semantic KBEdge direction
    // (report→manager) is unchanged; this only affects the drawn vis edge.
    const reverseForTree = hierarchical && e.relation === 'reports-to';
    return {
      id: `e${i}`,
      from: reverseForTree ? e.to : e.from,
      to: reverseForTree ? e.from : e.to,
      title: `${style.label}: ${e.description}`,
      color: {
        color: faded ? EDGE_FADED_COLOR : nearFaded ? 'rgba(80,80,80,0.25)' : style.color,
        hover: style.color,
        highlight: style.color,
      },
      width: faded ? 0.5 : style.width,
      dashes: faded ? false : style.dashes,
      length: e.weight ? springBase / e.weight : springBase,
    };
  });

  const nodes = new DataSet(nodeData);
  const edges = new DataSet(edgeData);

  // Build an edge lookup for fast emphasis updates
  const edgesByIndex = graph.edges.map((e, i) => ({ id: `e${i}`, from: e.from, to: e.to, type: e.type, relation: e.relation }));

  /** Dynamically update neighborhood emphasis without rebuilding the network. */
  const setEmphasis = (nodeId: string | null) => {
    // Skip emphasis if target node isn't in this graph
    const active = nodeId && nodeIdSet.has(nodeId) ? nodeId : null;

    // Build hop-distance map from focus node (BFS)
    const hopDistance = new Map<string, number>();
    if (active) {
      hopDistance.set(active, 0);
      const adjacency = new Map<string, string[]>();
      for (const edge of graph.edges) {
        if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
        if (!adjacency.has(edge.to)) adjacency.set(edge.to, []);
        adjacency.get(edge.from)!.push(edge.to);
        adjacency.get(edge.to)!.push(edge.from);
      }
      const queue = [active];
      while (queue.length > 0) {
        const current = queue.shift()!;
        const d = hopDistance.get(current)!;
        for (const neighbor of adjacency.get(current) ?? []) {
          if (!hopDistance.has(neighbor)) {
            hopDistance.set(neighbor, d + 1);
            queue.push(neighbor);
          }
        }
      }
    }

    // Update nodes — same as before, 1-hop neighborhood stays bright
    const hop1 = new Set<string>();
    if (active) {
      hop1.add(active);
      for (const edge of graph.edges) {
        if (edge.from === active) hop1.add(edge.to);
        if (edge.to === active) hop1.add(edge.from);
      }
    }

    const nodeUpdates: Record<string, unknown>[] = [];
    for (const n of graph.nodes) {
      const faded = active && !hop1.has(n.id);
      const sizeRange: [number, number] = faded
        ? [nodeSizeRange[0] * fadedSizeScale, nodeSizeRange[1] * fadedSizeScale]
        : nodeSizeRange;
      nodeUpdates.push(buildVisNode(n, {
        degrees, clusterColorMap, isDark, keyNodeIds,
        nodeSizeRange: sizeRange, nodeSizeStep, labelMaxLength,
        flagDisconnected: true,
        opacity: faded ? fadedOpacity : undefined,
        showLabel: faded ? showFadedLabels : true,
        // Force-label every 1-hop neighbour of the focus regardless of degree
        // (otherwise a sole-edge neighbour shows up as a circle with no text).
        labelDegreeThreshold: active && hop1.has(n.id) ? 0 : undefined,
      }));
    }
    nodes.update(nodeUpdates);

    // Update edges — multi-tier importance based on hop distance from focus
    // Tier 0: direct (both endpoints in 1-hop) → full color, full width
    // Tier 1: near (at least one endpoint in 1-hop) → type color at 50% opacity, reduced width
    // Tier 2: 2-hop bridge (both endpoints ≤ 2 hops) → type color at 25%, thin
    // Tier 3: distant → nearly invisible
    const edgeUpdates: Record<string, unknown>[] = [];
    for (const ei of edgesByIndex) {
      const style = edgeStyle(ei);
      if (!active) {
        // No focus — all edges at full style
        edgeUpdates.push({
          id: ei.id,
          color: { color: style.color, hover: style.color, highlight: style.color },
          width: style.width,
          dashes: style.dashes,
        });
        continue;
      }

      const fromHop = hopDistance.get(ei.from) ?? 999;
      const toHop = hopDistance.get(ei.to) ?? 999;
      const maxHop = Math.max(fromHop, toHop);
      const minHop = Math.min(fromHop, toHop);

      let color: string;
      let width: number;
      let dashes: boolean | number[];

      if (maxHop <= 1) {
        // Tier 0: direct neighborhood — full prominence
        color = style.color;
        width = style.width * 1.2;
        dashes = style.dashes;
      } else if (minHop <= 1) {
        // Tier 1: one endpoint is direct neighbor — visible but softer
        color = style.color + '80'; // 50% alpha
        width = style.width * 0.8;
        dashes = style.dashes;
      } else if (maxHop <= 2) {
        // Tier 2: 2-hop bridge — faint but colored
        color = style.color + '40'; // 25% alpha
        width = Math.max(style.width * 0.5, 0.8);
        dashes = style.dashes;
      } else {
        // Tier 3: distant — barely visible
        color = isDark ? 'rgba(60,60,60,0.15)' : 'rgba(180,180,180,0.15)';
        width = 0.4;
        dashes = false;
      }

      edgeUpdates.push({
        id: ei.id,
        color: { color, hover: style.color, highlight: style.color },
        width,
        dashes,
      });
    }
    edges.update(edgeUpdates);

    // DataSet updates can re-trigger physics — kill it immediately
    network.setOptions({ physics: { enabled: false } });
  };

  // Physics + layout differ by mode. Force mode uses forceAtlas2 stabilization;
  // the org tree uses vis-network's hierarchical layout with physics disabled —
  // deterministic and fast even for a hundreds-person org (#279).
  const physicsOptions = hierarchical
    ? { enabled: false }
    : {
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -120,
          // Higher centralGravity keeps the whole graph — including lightly-
          // connected (orphan) nodes — pulled toward the centre, preventing
          // them from drifting into a noisy ring at the periphery (#252).
          centralGravity: 0.06,
          springLength: 180,
          springConstant: 0.05,
          damping: 0.6,
        },
        stabilization: { enabled: true, iterations: 500, updateInterval: 100 },
      };

  const layoutOptions = hierarchical
    ? {
        // Explicit per-node `level` drives placement; we do NOT use
        // sortMethod:'directed' (our edges are report→manager, which would
        // invert the tree). Levels are authoritative.
        hierarchical: {
          enabled: true,
          direction: 'UD',
          levelSeparation: 160,
          nodeSpacing: 130,
          treeSpacing: 220,
          blockShifting: true,
          edgeMinimization: true,
          parentCentralization: true,
          shakeTowards: 'roots',
        },
      }
    : undefined;

  const network = new Network(container, { nodes, edges }, {
    nodes: {
      scaling: {
        // Label LOD is done by the custom renderer: non-key, low-degree nodes
        // are built with `label: ''` (see labelDegreeThreshold), so most nodes
        // paint no text at all. drawThreshold here is a secondary guard on
        // vis-network's own label scaling; min/max bound the painted font size.
        label: { enabled: true, min: 10, max: 16, drawThreshold: 8 },
      },
      font: { vadjust: 45, size: 13 },
    },
    ...(layoutOptions ? { layout: layoutOptions } : {}),
    physics: physicsOptions,
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
      smooth: { enabled: true, type: hierarchical ? 'cubicBezier' : 'continuous', roundness: 0.5 },
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

  // Finalize once: kill physics, compute pan bounds, wire bounded pan/zoom and
  // the initial fit/focus. Idempotent so it can be driven from `stabilized`
  // (force layout) or from rAF/afterDrawing (hierarchical layout, where physics
  // is disabled and `stabilized` never fires).
  let finalized = false;
  const finalizeLayout = () => {
    if (finalized) return;
    finalized = true;
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

    // Initial view: fit all (when requested) or focus on a specific node
    if (fitOnStabilize) {
      network.fit({
        animation: { duration: 50, easingFunction: 'easeInOutQuad' },
        maxZoomLevel: 2.0,
      });
      if (focusNodeId && nodes.get(focusNodeId)) {
        network.selectNodes([focusNodeId]);
      }
    } else if (focusNodeId && nodes.get(focusNodeId)) {
      network.fit({ animation: false });
      network.selectNodes([focusNodeId]);
      const pos = allPositions[focusNodeId] as { x: number; y: number } | undefined;
      if (pos) {
        const scale = 1.0;
        const target = clamp(pos.x, pos.y, scale);
        network.moveTo({
          position: target,
          scale,
          animation: { duration: 50, easingFunction: 'easeInOutQuad' },
        });
      }
    }
  };

  // Drive finalization. Force layout finalizes on `stabilized`; the org tree
  // (physics off) finalizes on the next frame, with `afterDrawing` as a
  // belt-and-suspenders fallback. `finalizeLayout` is idempotent.
  network.once('stabilized', finalizeLayout);
  if (hierarchical) {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(finalizeLayout);
    } else {
      setTimeout(finalizeLayout, 0);
    }
    network.once('afterDrawing', finalizeLayout);
  }

  if (auditSlot) {
    registerNetworkForAudit(network, container, auditSlot);
  }

  return { network, nodes, edges, setEmphasis };
}

/**
 * Debug hook: when an audit (or a developer) needs to introspect a live
 * vis-network instance (positions, bounding boxes, label state) we expose
 * the live networks on `window.__kbeNetworks` keyed by the container's
 * `data-kbe-graph` attribute or `id`. This is a no-op when there is no
 * `window` (SSR / Node) and adds a tiny amount of memory in the browser.
 *
 * Used by `scripts/audit-visual.mjs` to assert on label coverage, node-to-
 * label ratio, and edge visibility on the actually-rendered constellation.
 */
function registerNetworkForAudit(network: Network, container: HTMLElement, slot: string) {
  if (typeof window === 'undefined') return;
  type AuditWindow = Window & {
    __kbeNetworks?: Record<string, { network: Network; container: HTMLElement }>;
  };
  const w = window as AuditWindow;
  if (!w.__kbeNetworks) w.__kbeNetworks = {};
  w.__kbeNetworks[slot] = { network, container };
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
        centralGravity: 0.06,
        springLength: 180,
        springConstant: 0.05,
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
