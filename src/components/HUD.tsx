import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  makeStyles,
  tokens,
  Button,
  Slider,
  Card,
  CardHeader,
  Body1Strong,
  Caption1,
  Caption2,
} from '@fluentui/react-components';
import {
  ChevronLeftRegular,
  ChevronRightRegular,
  ChevronUpRegular,
  ChevronDownRegular,
  ArrowDownRegular,
  ArrowUpRegular,
  ArrowLeftRegular,
  ArrowRightRegular,
  ArrowExpandRegular,
  DismissRegular,
  MapRegular,
  MyLocationRegular,
  WeatherMoonRegular,
  WeatherSunnyRegular,
  BookRegular,
  GridRegular,
  PanelBottomRegular,
  PanelLeftRegular,
  PanelRightRegular,
  PanelTopExpandRegular,
} from '@fluentui/react-icons';
import type { KBGraph, KBConfig, KBNode, Theme, EdgeType } from '../types';
import { EDGE_TYPE_STYLES, BUILT_IN_VIEWS, filterGraphToView, collapseGraphClusters, trimGraphToLimits } from '../types';
import type { TrimResult } from '../types';
import { NodeVisual, FLUENT_ICONS, isFluentIconName } from './NodeVisual';
import { createGraphNetwork, computeGraphPositions } from '../engine/createGraphNetwork';
import { ICON_NODE_SHAPE } from '../engine/nodeRenderer';

export type DockPosition = 'bottom' | 'left' | 'right' | 'top';

interface HUDProps {
  graph: KBGraph;
  config: KBConfig;
  currentNodeId: string | null;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onCollapsedChange?: (collapsed: boolean) => void;
  onDockChange?: (dock: DockPosition) => void;
}

const FONT_SIZES = [0.92, 1.0, 1.1, 1.2, 1.35, 1.5, 1.6];
const COL_WIDTHS = ['50%', '65%', '75%', '85%', '100%'];

const HIGHLIGHT_COLOR_DARK = '#479ef5';  // colorBrandForeground1
const HIGHLIGHT_COLOR_LIGHT = '#0f6cbd';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function readPersisted(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key);
    if (v !== null) {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
  } catch { /* ignore */ }
  return fallback;
}

function readPersistedString(key: string, fallback: string): string {
  try {
    const v = localStorage.getItem(key);
    if (v !== null) return v;
  } catch { /* ignore */ }
  return fallback;
}

const useStyles= makeStyles({
  hud: {
    position: 'fixed',
    backgroundColor: tokens.colorNeutralBackground1,
    display: 'flex',
    zIndex: 100,
    color: tokens.colorNeutralForeground1,
    boxShadow: tokens.shadow16,
    overflow: 'hidden',
  },
  panelLeft: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacingVerticalXS,
    flexShrink: 0,
  },
  panelCenter: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    gap: tokens.spacingVerticalXS,
    justifyContent: 'center',
    alignItems: 'center',
  },
  panelRight: {
    display: 'flex',
    flexDirection: 'column',
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    flexShrink: 0,
    gap: tokens.spacingVerticalXXS,
    justifyContent: 'center',
  },
  minimap: {
    width: '120px',
    height: '80px',
    cursor: 'pointer',
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  navRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  currentNode: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flex: 1,
    minWidth: 0,
  },
  currentTitle: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  placeholder: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    textAlign: 'center',
    padding: `${tokens.spacingVerticalS} 0`,
  },
  relatedStrip: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
    flex: 1,
    minHeight: 0,
    alignItems: 'flex-start',
    alignContent: 'flex-start',
    justifyContent: 'center',
  },
  relatedCard: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    flexShrink: 0,
    minWidth: '180px',
    textDecoration: 'none',
    color: 'inherit',
    cursor: 'pointer',
  },
  relatedTitle: {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    whiteSpace: 'normal',
    maxWidth: '180px',
  },
  toolRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  toolLabel: {
    width: '54px',
    flexShrink: 0,
  },
  slider: {
    flex: 1,
    minWidth: 0,
  },
  // Constellation overlay
  overlay: {
    position: 'fixed',
    inset: '0',
    zIndex: 300,
    backgroundColor: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animationName: {
      from: {
        opacity: 0,
        transform: 'scale(0.3)',
        transformOrigin: 'bottom left',
      },
      to: {
        opacity: 1,
        transform: 'scale(1)',
        transformOrigin: 'bottom left',
      },
    },
    animationDuration: '0.35s',
    animationTimingFunction: 'cubic-bezier(0.33, 1, 0.68, 1)',
  },
  overlayInner: {
    width: '95vw',
    height: '92vh',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    overflow: 'hidden',
    boxShadow: tokens.shadow64,
    borderRadius: tokens.borderRadiusXLarge,
    animationName: {
      from: {
        opacity: 0,
        transform: 'scale(0.4) translate(-30%, 30%)',
      },
      to: {
        opacity: 1,
        transform: 'scale(1) translate(0, 0)',
      },
    },
    animationDuration: '0.4s',
    animationTimingFunction: 'cubic-bezier(0.33, 1, 0.68, 1)',
  },
  overlayGraph: {
    flex: 1,
    minHeight: 0,
  },
  collapsedBar: {
    display: 'flex',
    alignItems: 'center',
    flex: 1,
    padding: `0 ${tokens.spacingHorizontalM}`,
    gap: tokens.spacingHorizontalS,
  },
  collapseBtn: {
    position: 'absolute',
    zIndex: 1,
  },
  expandedContent: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    position: 'relative',
  },
  dockBtnGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
});

export function HUD({ graph, config, currentNodeId, theme, onThemeChange, onCollapsedChange, onDockChange }: HUDProps) {
  const styles = useStyles();
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasMountKey, setCanvasMountKey] = useState(0);
  const canvasRef = useCallback((el: HTMLCanvasElement | null) => {
    canvasElRef.current = el;
    if (el) setCanvasMountKey(k => k + 1); // trigger redraw
  }, []);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sidebarGraphRef = useRef<HTMLDivElement>(null);

  const [fontSize, setFontSize] = useState(() => readPersisted('kbe-font-size', 1));
  const [colWidth, setColWidth] = useState(() => readPersisted('kbe-col-width', 2));
  const [mapExpanded, setMapExpanded] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => readPersisted('kbe-sidebar-w', 25));
  const [mapSplit, setMapSplit] = useState(() => readPersisted('kbe-map-split', 50));
  const [sidebarZoom, setSidebarZoom] = useState(180);
  const [overlayZoom, setOverlayZoom] = useState(100);

  // Detail: 5 non-linear steps — [5, 15, 40, 70, 100] nodes
  const DETAIL_STEPS = [5, 15, 40, 70, 100];
  const [detailIdx, setDetailIdx] = useState(() => readPersisted('kbe-detail', 2));
  const detailLevel = DETAIL_STEPS[Math.min(detailIdx, DETAIL_STEPS.length - 1)];
  const [activeView, setActiveView] = useState<string>(() => {
    try {
      const stored = localStorage.getItem('kbe-view');
      if (stored && BUILT_IN_VIEWS.some(v => v.id === stored)) return stored;
      // Migrate from old layer system
      const oldLayer = localStorage.getItem('kbe-layer');
      if (oldLayer === 'file') return 'code';
      if (oldLayer === 'content') return 'content';
      if (oldLayer === 'work') return 'work';
    } catch { /* ignore */ }
    return 'all';
  });
  const [collapsedClusters, setCollapsedClusters] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('kbe-collapsed-clusters');
      if (stored) return new Set(JSON.parse(stored) as string[]);
    } catch { /* ignore */ }
    return new Set<string>();
  });
  const resizeRef = useRef<{ startX: number; startW: number } | null>(null);
  const splitResizeRef = useRef<{ startY: number; startPct: number } | null>(null);

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('kbe-hud-collapsed') === 'true'; } catch { return false; }
  });
  const [dock, setDock] = useState<DockPosition>(() =>
    readPersistedString('kbe-hud-dock', 'bottom') as DockPosition,
  );

  const handleCollapse = useCallback((value: boolean) => {
    setCollapsed(value);
    try { localStorage.setItem('kbe-hud-collapsed', String(value)); } catch { /* ignore */ }
    onCollapsedChange?.(value);
  }, [onCollapsedChange]);

  const handleDockChange = useCallback((value: DockPosition) => {
    setDock(value);
    try { localStorage.setItem('kbe-hud-dock', value); } catch { /* ignore */ }
    onDockChange?.(value);
  }, [onDockChange]);

  // Sidebar resize drag
  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    resizeRef.current = { startX: e.clientX, startW: sidebarWidth };
    const onMove = (ev: PointerEvent) => {
      if (!resizeRef.current) return;
      const delta = dock === 'left'
        ? ev.clientX - resizeRef.current.startX
        : resizeRef.current.startX - ev.clientX;
      const deltaVw = delta / window.innerWidth * 100;
      const newW = Math.max(15, Math.min(50, resizeRef.current.startW + deltaVw));
      setSidebarWidth(newW);
    };
    const onUp = () => {
      resizeRef.current = null;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      try { localStorage.setItem('kbe-sidebar-w', String(sidebarWidth)); } catch { /* */ }
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [dock, sidebarWidth]);

  // Vertical split resize (map vs connections)
  const handleSplitResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    splitResizeRef.current = { startY: e.clientY, startPct: mapSplit };
    const sidebar = (e.target as HTMLElement).closest('[class]')?.parentElement;
    const sidebarH = sidebar?.clientHeight ?? window.innerHeight;
    const onMove = (ev: PointerEvent) => {
      if (!splitResizeRef.current) return;
      const deltaPct = ((ev.clientY - splitResizeRef.current.startY) / sidebarH) * 100;
      const newPct = Math.max(20, Math.min(80, splitResizeRef.current.startPct + deltaPct));
      setMapSplit(newPct);
    };
    const onUp = () => {
      splitResizeRef.current = null;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      try { localStorage.setItem('kbe-map-split', String(mapSplit)); } catch { /* */ }
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [mapSplit]);

  const selectView = useCallback((viewId: string) => {
    setActiveView(viewId);
    try { localStorage.setItem('kbe-view', viewId); } catch { /* */ }
  }, []);

  const toggleClusterCollapse = useCallback((clusterId: string) => {
    setCollapsedClusters(prev => {
      const next = new Set(prev);
      if (next.has(clusterId)) next.delete(clusterId);
      else next.add(clusterId);
      try { localStorage.setItem('kbe-collapsed-clusters', JSON.stringify([...next])); } catch { /* */ }
      return next;
    });
  }, []);

  // Filter graph: view → cluster collapse → trim to limits
  const trimResult = React.useMemo<TrimResult>(() => {
    let g = filterGraphToView(graph, activeView);
    if (collapsedClusters.size > 0) g = collapseGraphClusters(g, collapsedClusters);
    return trimGraphToLimits(g, currentNodeId, detailLevel, Infinity);
  }, [graph, activeView, collapsedClusters, currentNodeId, detailLevel]);

  const filteredGraph = trimResult.graph;

  const currentNode = currentNodeId
    ? filteredGraph.nodes.find(n => n.id === currentNodeId) ?? graph.nodes.find(n => n.id === currentNodeId) ?? null
    : null;

  const currentIdx = currentNode
    ? filteredGraph.nodes.findIndex(n => n.id === currentNodeId)
    : -1;

  const relatedIds = currentNodeId ? (filteredGraph.related[currentNodeId] ?? graph.related[currentNodeId] ?? []) : [];
  const relatedNodes = relatedIds
    .map(id => graph.nodes.find(n => n.id === id))
    .filter((n): n is KBNode => n != null);

  // Apply CSS variables
  useEffect(() => {
    document.documentElement.style.setProperty('--prose-font-size', `${FONT_SIZES[fontSize]}rem`);
    localStorage.setItem('kbe-font-size', String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    document.documentElement.style.setProperty('--prose-max-width', COL_WIDTHS[colWidth]);
    localStorage.setItem('kbe-col-width', String(colWidth));
  }, [colWidth]);

  // Publish sidebar width as CSS variable for content padding
  useEffect(() => {
    const isV = dock === 'left' || dock === 'right';
    document.documentElement.style.setProperty('--kbe-sidebar-width', isV && !collapsed ? `${sidebarWidth}vw` : '0px');
    try { localStorage.setItem('kbe-sidebar-w', String(sidebarWidth)); } catch { /* */ }
  }, [sidebarWidth, dock, collapsed]);

  useEffect(() => {
    try { localStorage.setItem('kbe-map-split', String(mapSplit)); } catch { /* */ }
  }, [mapSplit]);

  // Minimap layout positions via hidden vis-network
  const [minimapPositions, setMinimapPositions] = useState<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    const cleanup = computeGraphPositions(filteredGraph, (posMap) => {
      setMinimapPositions(posMap);
    });
    return cleanup;
  }, [filteredGraph]);

  const drawMinimap = useCallback(() => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const posMap = minimapPositions;
    if (posMap.size === 0) return;

    const edgeColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.12)';
    const highlightColor = theme === 'dark' ? HIGHLIGHT_COLOR_DARK : HIGHLIGHT_COLOR_LIGHT;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth || 120;
    const H = canvas.clientHeight || 80;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const pos of posMap.values()) {
      minX = Math.min(minX, pos.x); maxX = Math.max(maxX, pos.x);
      minY = Math.min(minY, pos.y); maxY = Math.max(maxY, pos.y);
    }
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const pad = 12;
    const scale = Math.min((W - pad * 2) / rangeX, (H - pad * 2) / rangeY);

    function toCanvas(x: number, y: number): [number, number] {
      return [
        pad + (x - minX) * scale + ((W - pad * 2) - rangeX * scale) / 2,
        pad + (y - minY) * scale + ((H - pad * 2) - rangeY * scale) / 2,
      ];
    }

    // Draw edges
    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = 0.5;
    for (const edge of filteredGraph.edges) {
      const from = posMap.get(edge.from);
      const to = posMap.get(edge.to);
      if (from && to) {
        const [fx, fy] = toCanvas(from.x, from.y);
        const [tx, ty] = toCanvas(to.x, to.y);
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }
    }

    // Draw nodes with shape-matched outlines
    const clusterColorMap = new Map(filteredGraph.clusters.map(c => [c.id, c.color]));

    for (const node of filteredGraph.nodes) {
      const pos = posMap.get(node.id);
      if (!pos) continue;
      const [cx, cy] = toCanvas(pos.x, pos.y);
      const isCurrent = node.id === currentNodeId;
      const color = clusterColorMap.get(node.cluster) ?? '#888';
      const r = isCurrent ? 5 : 3.5;
      const shape = (node.emoji && ICON_NODE_SHAPE[node.emoji]) || 'circle';

      ctx.beginPath();
      if (shape === 'circle') {
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
      } else if (shape === 'roundedSquare') {
        const cr = r * 0.3;
        ctx.moveTo(cx - r + cr, cy - r);
        ctx.lineTo(cx + r - cr, cy - r);
        ctx.quadraticCurveTo(cx + r, cy - r, cx + r, cy - r + cr);
        ctx.lineTo(cx + r, cy + r - cr);
        ctx.quadraticCurveTo(cx + r, cy + r, cx + r - cr, cy + r);
        ctx.lineTo(cx - r + cr, cy + r);
        ctx.quadraticCurveTo(cx - r, cy + r, cx - r, cy + r - cr);
        ctx.lineTo(cx - r, cy - r + cr);
        ctx.quadraticCurveTo(cx - r, cy - r, cx - r + cr, cy - r);
        ctx.closePath();
      } else {
        // roundedRect — wider
        const hw = r * 1.3;
        const cr = r * 0.3;
        ctx.moveTo(cx - hw + cr, cy - r);
        ctx.lineTo(cx + hw - cr, cy - r);
        ctx.quadraticCurveTo(cx + hw, cy - r, cx + hw, cy - r + cr);
        ctx.lineTo(cx + hw, cy + r - cr);
        ctx.quadraticCurveTo(cx + hw, cy + r, cx + hw - cr, cy + r);
        ctx.lineTo(cx - hw + cr, cy + r);
        ctx.quadraticCurveTo(cx - hw, cy + r, cx - hw, cy + r - cr);
        ctx.lineTo(cx - hw, cy - r + cr);
        ctx.quadraticCurveTo(cx - hw, cy - r, cx - hw + cr, cy - r);
        ctx.closePath();
      }

      ctx.fillStyle = isCurrent ? highlightColor : hexToRgba(color, 0.6);
      ctx.fill();
      ctx.strokeStyle = isCurrent ? highlightColor : hexToRgba(color, 0.9);
      ctx.lineWidth = isCurrent ? 1.5 : 0.8;
      ctx.stroke();
    }
  }, [filteredGraph, currentNodeId, theme, dock, minimapPositions, canvasMountKey]);

  useEffect(() => { const t = setTimeout(() => drawMinimap(), 50); return () => clearTimeout(t); }, [drawMinimap]);

  // Expanded map overlay (vis-network)
  useEffect(() => {
    if (!mapExpanded || !overlayRef.current) return;

    const { network, setEmphasis: overlaySetEmphasis } = createGraphNetwork({
      container: overlayRef.current,
      graph: filteredGraph,
      isDark: theme === 'dark',
      onNodeClick: (id) => {
        setMapExpanded(false);
        window.location.hash = `/node/${encodeURIComponent(id)}`;
      },
      focusNodeId: currentNodeId,
      fitOnStabilize: !currentNodeId || filteredGraph.nodes.length < 60,
      emphasizeNodeId: currentNodeId,
      interactive: true,
    });
    network.once('stabilized', () => {
      const scale = network.getScale();
      network.setOptions({
        interaction: { zoomView: true, dragView: true },
      });
      network.moveTo({ scale: Math.max(scale, 0.3) });
      setOverlayZoom(Math.round(network.getScale() * 100));
    });
    network.on('zoom', () => {
      setOverlayZoom(Math.round(network.getScale() * 100));
    });
    overlayNetworkRef.current = network;
    overlayEmphasisRef.current = overlaySetEmphasis;

    return () => { network.destroy(); overlayNetworkRef.current = null; overlayEmphasisRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapExpanded, filteredGraph, config]);

  // Sidebar live graph (left/right dock)
  const isVertical = dock === 'left' || dock === 'right';
  const sidebarNetworkRef = useRef<import('vis-network/standalone').Network | null>(null);
  const overlayNetworkRef = useRef<import('vis-network/standalone').Network | null>(null);
  const sidebarNodesRef = useRef<import('vis-data').DataSet<Record<string, unknown>> | null>(null);
  const sidebarEmphasisRef = useRef<((nodeId: string | null) => void) | null>(null);
  const overlayEmphasisRef = useRef<((nodeId: string | null) => void) | null>(null);

  // Create the network once (on dock/graph/theme change)
  useEffect(() => {
    if (!isVertical || collapsed || !sidebarGraphRef.current) return;

    const timer = setTimeout(() => {
      if (!sidebarGraphRef.current) return;
      if (sidebarNetworkRef.current) {
        try { sidebarNetworkRef.current.destroy(); } catch { /* */ }
      }
      const { network, nodes: visNodes, setEmphasis } = createGraphNetwork({
        container: sidebarGraphRef.current,
        graph: filteredGraph,        isDark: theme === 'dark',
        onNodeClick: (id) => {
          window.location.hash = `/node/${encodeURIComponent(id)}`;
        },
        focusNodeId: currentNodeId,
        fitOnStabilize: !currentNodeId || filteredGraph.nodes.length < 60,
        emphasizeNodeId: currentNodeId,
        interactive: true,
        nodeSizeRange: [28, 44],
        nodeSizeStep: 3,
        labelMaxLength: 18,
      });
      network.once('stabilized', () => {
        setSidebarZoom(Math.round(network.getScale() * 100));
      });
      network.on('zoom', () => {
        setSidebarZoom(Math.round(network.getScale() * 100));
      });
      sidebarNetworkRef.current = network;
      sidebarNodesRef.current = visNodes;
      sidebarEmphasisRef.current = setEmphasis;
    }, 100);

    return () => {
      clearTimeout(timer);
      if (sidebarNetworkRef.current) {
        try { sidebarNetworkRef.current.destroy(); } catch { /* */ }
        sidebarNetworkRef.current = null;
        sidebarNodesRef.current = null;
        sidebarEmphasisRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVertical, collapsed, filteredGraph, theme]);

  // Update selection + focus + neighborhood emphasis when currentNodeId changes (no rebuild)
  useEffect(() => {
    const net = sidebarNetworkRef.current;
    if (!net) return;

    // Update neighborhood emphasis dynamically
    sidebarEmphasisRef.current?.(currentNodeId);

    if (!currentNodeId) return;
    try {
      net.selectNodes([currentNodeId]);
      net.focus(currentNodeId, {
        scale: 1.0,
        animation: { duration: 300, easingFunction: 'easeInOutQuad' },
      });
    } catch { /* node might not exist */ }
  }, [currentNodeId]);

  // Active clusters: use the view-filtered (but not collapsed) graph for the legend
  const activeClusters = React.useMemo(() => {
    const viewGraph = filterGraphToView(graph, activeView);
    const counts = new Map<string, number>();
    for (const n of viewGraph.nodes) counts.set(n.cluster, (counts.get(n.cluster) ?? 0) + 1);
    return viewGraph.clusters.filter(c => (counts.get(c.id) ?? 0) >= 2);
  }, [graph, activeView]);

  // Active edge types present in the graph
  const activeEdgeTypes = React.useMemo(() => {
    const types = new Set<EdgeType>();
    for (const e of filteredGraph.edges) if (e.type) types.add(e.type);
    return Array.from(types).sort((a, b) => {
      const order: EdgeType[] = ['contains', 'derived_from', 'imports', 'references', 'cross_references', 'frontmatter', 'closes', 'modifies', 'mentions', 'related'];
      return order.indexOf(a) - order.indexOf(b);
    });
  }, [filteredGraph]);

  const navigateTo = useCallback((hash: string) => {
    window.location.hash = hash;
  }, []);

  const goPrev = () => {
    if (currentIdx < 0) return;
    const prev = (currentIdx - 1 + graph.nodes.length) % graph.nodes.length;
    navigateTo(`#/node/${encodeURIComponent(graph.nodes[prev].id)}`);
  };

  const goNext = () => {
    if (currentIdx < 0) return;
    const next = (currentIdx + 1) % graph.nodes.length;
    navigateTo(`#/node/${encodeURIComponent(graph.nodes[next].id)}`);
  };

  const contentDirection: 'column' | 'row' = isVertical ? 'column' : 'row';

  const hudContainerStyle: React.CSSProperties = {
    transition: isVertical ? 'width 0.3s ease-out' : 'height 0.3s ease-out',
    ...(dock === 'bottom' ? {
      bottom: 0, left: 0, right: 0,
      height: collapsed ? 40 : 148,
      borderTop: `2px solid ${tokens.colorNeutralStroke1}`,
    } : dock === 'top' ? {
      top: 0, left: 0, right: 0,
      height: collapsed ? 40 : 148,
      borderBottom: `2px solid ${tokens.colorNeutralStroke1}`,
    } : dock === 'left' ? {
      top: 0, left: 0, bottom: 0,
      width: collapsed ? 40 : `${sidebarWidth}vw`,
    } : {
      top: 0, right: 0, bottom: 0,
      width: collapsed ? 40 : `${sidebarWidth}vw`,
    }),
  };

  // Collapse button position depends on dock
  const collapseBtnStyle: React.CSSProperties = dock === 'top'
    ? { bottom: 4, right: 8 }
    : dock === 'left'
    ? { top: 4, right: 4 }
    : dock === 'right'
    ? { top: 4, left: 4 }
    : { top: 4, right: 8 };

  const collapseIcon = dock === 'top' ? <ChevronUpRegular /> : dock === 'left' ? <ChevronLeftRegular /> : dock === 'right' ? <ChevronRightRegular /> : <ChevronDownRegular />;
  const expandIcon = dock === 'top' ? <ChevronDownRegular /> : dock === 'left' ? <ChevronRightRegular /> : dock === 'right' ? <ChevronLeftRegular /> : <ChevronUpRegular />;

  const themeButtons = (
    <>
      <Button
        appearance={theme === 'dark' ? 'primary' : 'subtle'}
        size="small"
        icon={<WeatherMoonRegular />}
        onClick={() => onThemeChange('dark')}
        title="Dark"
      />
      <Button
        appearance={theme === 'light' ? 'primary' : 'subtle'}
        size="small"
        icon={<WeatherSunnyRegular />}
        onClick={() => onThemeChange('light')}
        title="Light"
      />
      <Button
        appearance={theme === 'sepia' ? 'primary' : 'subtle'}
        size="small"
        icon={<BookRegular />}
        onClick={() => onThemeChange('sepia')}
        title="Sepia"
      />
    </>
  );

  const nodeTitle = currentNode?.title ?? config.title;

  return (
    <>
      {/* Constellation overlay */}
      {mapExpanded && (
        <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) setMapExpanded(false); }}>
          <div className={styles.overlayInner}>
            <div ref={overlayRef} className={styles.overlayGraph} />
            <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, display: 'flex', gap: 4 }}>
              <Button
                appearance="subtle"
                icon={<MyLocationRegular />}
                onClick={() => {
                  const net = overlayNetworkRef.current;
                  if (!net) return;
                  if (currentNodeId) {
                    try {
                      net.focus(currentNodeId, { scale: 1.0, animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
                      return;
                    } catch { /* node not found, fall through to fit */ }
                  }
                  net.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' }, maxZoomLevel: 1.5 });
                }}
                aria-label="Re-center"
                title="Re-center graph"
              />
              <Button
                appearance="subtle"
                icon={<DismissRegular />}
                onClick={() => setMapExpanded(false)}
                aria-label="Close"
              />
            </div>
            {/* View selector in overlay */}
            <div style={{
              position: 'absolute', top: 12, left: 12, zIndex: 10,
              display: 'flex', gap: 4,
            }}>
              {BUILT_IN_VIEWS.map(view => {
                const active = activeView === view.id;
                return (
                  <button
                    key={view.id}
                    onClick={() => selectView(view.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '4px 12px', fontSize: 12, fontWeight: 500,
                      border: `1px solid ${active ? view.color : tokens.colorNeutralStroke2}`,
                      borderRadius: 14, cursor: 'pointer',
                      background: active ? (view.id === 'all' ? tokens.colorNeutralBackground3 : view.color + '22') : tokens.colorNeutralBackground1,
                      color: active ? view.color : tokens.colorNeutralForeground3,
                      opacity: active ? 1 : 0.6,
                    }}
                    title={`${view.name} view`}
                  >
                    {view.id !== 'all' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: view.color, opacity: active ? 1 : 0.3 }} />}
                    {view.name}
                  </button>
                );
              })}
            </div>
            {trimResult.trimmed && (
              <Caption2 style={{
                position: 'absolute', top: 42, left: 14, zIndex: 10,
                color: tokens.colorNeutralForeground3, opacity: 0.8,
              }}>
                Showing {filteredGraph.nodes.length} of {trimResult.totalNodes} nodes
              </Caption2>
            )}
            <Card size="small" style={{ position: 'absolute', bottom: 16, left: 16, zIndex: 10 }}>
              <CardHeader header={<Caption1><strong>Clusters</strong></Caption1>} />
              {activeClusters.map(c => {
                const isCollapsed = collapsedClusters.has(c.id);
                return (
                  <div
                    key={c.id}
                    onClick={() => toggleClusterCollapse(c.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 12px', cursor: 'pointer', opacity: isCollapsed ? 0.5 : 1 }}
                    title={isCollapsed ? `Expand ${c.name}` : `Collapse ${c.name}`}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                    <Caption1 style={{ textDecoration: isCollapsed ? 'line-through' : 'none' }}>{c.name}</Caption1>
                  </div>
                );
              })}
              {activeEdgeTypes.length > 0 && (
                <>
                  <div style={{ borderTop: `1px solid ${tokens.colorNeutralStroke2}`, margin: '4px 12px' }} />
                  {activeEdgeTypes.map(t => {
                    const s = EDGE_TYPE_STYLES[t];
                    return (
                      <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 12px' }}>
                        <svg width={18} height={8} style={{ flexShrink: 0 }}>
                          <line x1={0} y1={4} x2={18} y2={4}
                            stroke={s.color} strokeWidth={Math.max(s.width, 1.2)}
                            strokeDasharray={Array.isArray(s.dashes) ? s.dashes.join(',') : undefined} />
                        </svg>
                        <Caption1>{s.label}</Caption1>
                      </div>
                    );
                  })}
                </>
              )}
            </Card>
            {/* Zoom & Detail sliders */}
            <div style={{
              position: 'absolute', bottom: 16, right: 16, zIndex: 10,
              display: 'flex', alignItems: 'center', gap: 16,
              background: tokens.colorNeutralBackground1,
              borderRadius: tokens.borderRadiusMedium,
              border: `1px solid ${tokens.colorNeutralStroke2}`,
              padding: '6px 12px',
              opacity: 0.9,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Detail</Caption1>
                <Slider
                  min={0}
                  max={4}
                  step={1}
                  value={detailIdx}
                  onChange={(_e, data) => {
                    setDetailIdx(data.value);
                    try { localStorage.setItem('kbe-detail', String(data.value)); } catch { /* */ }
                  }}
                  style={{ width: 100 }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Zoom</Caption1>
                <Slider
                  min={20}
                  max={200}
                  step={10}
                  value={overlayZoom}
                  onChange={(_e, data) => {
                    setOverlayZoom(data.value);
                    overlayNetworkRef.current?.moveTo({
                      scale: data.value / 100,
                      animation: { duration: 150, easingFunction: 'easeInOutQuad' },
                    });
                  }}
                  style={{ width: 100 }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={styles.hud} style={hudContainerStyle}>
        {collapsed ? (
          <div
            className={styles.collapsedBar}
            onClick={isVertical ? () => handleCollapse(false) : undefined}
            style={{
              ...(isVertical ? { cursor: 'pointer' } : undefined),
              ...(isVertical ? { [dock === 'left' ? 'borderRight' : 'borderLeft']: `2px solid ${tokens.colorNeutralStroke1}` } : undefined),
            }}
            title={isVertical ? 'Click to expand' : undefined}
          >
            <Button
              size="small"
              appearance="subtle"
              icon={expandIcon}
              onClick={(e) => { e.stopPropagation(); handleCollapse(false); }}
              title="Expand"
            />
            {!isVertical && (
              <>
                <div className={styles.currentNode} style={{ justifyContent: 'center' }}>
                  {currentNode?.emoji && isFluentIconName(currentNode.emoji) ? (
                    (() => { const Icon = FLUENT_ICONS[currentNode.emoji]; return <Icon style={{ fontSize: 20 }} />; })()
                  ) : (
                    <span style={{ fontSize: tokens.fontSizeBase500 }}>{currentNode?.emoji ?? ''}</span>
                  )}
                  <Body1Strong className={styles.currentTitle}>{nodeTitle}</Body1Strong>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                  {themeButtons}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className={styles.expandedContent} style={{ flexDirection: contentDirection }}>
            <Button
              className={styles.collapseBtn}
              style={collapseBtnStyle}
              size="small"
              appearance="subtle"
              icon={collapseIcon}
              onClick={() => handleCollapse(true)}
              title="Collapse"
            />

            {/* Minimap — always mounted, one canvas element */}
            {isVertical ? (
              <>
                {/* Sidebar width resize handle */}
                <div
                  onPointerDown={handleResizeStart}
                  style={{
                    position: 'absolute',
                    top: 0,
                    [dock === 'left' ? 'right' : 'left']: -4,
                    width: 12,
                    height: '100%',
                    cursor: 'col-resize',
                    zIndex: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: tokens.colorNeutralStroke1,
                  }}
                >
                  <div style={{
                    width: 4,
                    height: 32,
                    borderRadius: 2,
                    background: tokens.colorNeutralBackground1,
                    opacity: 0.8,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: 2,
                  }}>
                    <div style={{ width: 4, height: 1, background: tokens.colorNeutralForeground3, borderRadius: 1 }} />
                    <div style={{ width: 4, height: 1, background: tokens.colorNeutralForeground3, borderRadius: 1 }} />
                    <div style={{ width: 4, height: 1, background: tokens.colorNeutralForeground3, borderRadius: 1 }} />
                  </div>
                </div>

                {/* Live constellation graph */}
                <div style={{ flex: `0 0 ${mapSplit}%`, minHeight: '20%', position: 'relative', overflow: 'hidden', paddingTop: 36 }}>
                  <div
                    ref={sidebarGraphRef}
                    style={{ width: '100%', height: '100%' }}
                  />
                  {/* View selector */}
                  <div style={{
                    position: 'absolute', top: 6, left: 8, right: 68, zIndex: 6,
                    display: 'flex', gap: 3, flexWrap: 'wrap',
                  }}>
                    {BUILT_IN_VIEWS.map(view => {
                      const active = activeView === view.id;
                      return (
                        <button
                          key={view.id}
                          onClick={() => selectView(view.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '2px 8px', fontSize: 10, fontWeight: 500,
                            border: `1px solid ${active ? view.color : tokens.colorNeutralStroke2}`,
                            borderRadius: 12, cursor: 'pointer',
                            background: active ? (view.id === 'all' ? tokens.colorNeutralBackground3 : view.color + '22') : 'transparent',
                            color: active ? view.color : tokens.colorNeutralForeground3,
                            opacity: active ? 1 : 0.5,
                          }}
                          title={`${view.name} view`}
                        >
                          {view.id !== 'all' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: view.color, opacity: active ? 1 : 0.3 }} />}
                          {view.name}
                        </button>
                      );
                    })}
                  </div>
                  {/* Trim indicator */}
                  {trimResult.trimmed && (
                    <Caption2 style={{
                      position: 'absolute', top: 28, left: 10, zIndex: 7,
                      color: tokens.colorNeutralForeground3, opacity: 0.7, fontSize: 9,
                      pointerEvents: 'none',
                    }}>
                      {filteredGraph.nodes.length}/{trimResult.totalNodes} nodes
                    </Caption2>
                  )}
                  {/* Legend overlay with background */}
                  <div style={{
                    position: 'absolute', top: 42, left: 8, fontSize: 11, lineHeight: '18px',
                    background: tokens.colorNeutralBackground1, borderRadius: tokens.borderRadiusMedium,
                    border: `1px solid ${tokens.colorNeutralStroke2}`, padding: '6px 8px',
                    opacity: 0.9,
                  }}>
                    {activeClusters.map(c => {
                      const isCollapsed = collapsedClusters.has(c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => toggleClusterCollapse(c.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', opacity: isCollapsed ? 0.5 : 1 }}
                          title={isCollapsed ? `Expand ${c.name}` : `Collapse ${c.name}`}
                        >
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                          <span style={{ color: tokens.colorNeutralForeground3, textDecoration: isCollapsed ? 'line-through' : 'none' }}>{c.name}</span>
                        </div>
                      );
                    })}
                    {activeEdgeTypes.length > 0 && (
                      <>
                        <div style={{ borderTop: `1px solid ${tokens.colorNeutralStroke2}`, margin: '4px 0' }} />
                        {activeEdgeTypes.map(t => {
                          const s = EDGE_TYPE_STYLES[t];
                          return (
                            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <svg width={14} height={7} style={{ flexShrink: 0 }}>
                                <line x1={0} y1={3.5} x2={14} y2={3.5}
                                  stroke={s.color} strokeWidth={Math.max(s.width, 1)}
                                  strokeDasharray={Array.isArray(s.dashes) ? s.dashes.join(',') : undefined} />
                              </svg>
                              <span style={{ color: tokens.colorNeutralForeground3 }}>{s.label}</span>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                  {/* Re-center the graph */}
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<MyLocationRegular />}
                    onClick={() => {
                      const net = sidebarNetworkRef.current;
                      if (!net) return;
                      if (currentNodeId) {
                        try {
                          net.focus(currentNodeId, { scale: 1.0, animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
                          return;
                        } catch { /* node not found, fall through to fit */ }
                      }
                      net.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' }, maxZoomLevel: 1.5 });
                    }}
                    title="Re-center graph"
                    style={{ position: 'absolute', top: 42, right: 36, zIndex: 5 }}
                  />
                  {/* Expand to full-screen overlay */}
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<ArrowExpandRegular />}
                    onClick={() => setMapExpanded(true)}
                    title="Expand constellation"
                    style={{ position: 'absolute', top: 42, right: 8, zIndex: 5 }}
                  />
                  {/* Detail & Zoom sliders */}
                  <div style={{
                    position: 'absolute', bottom: 8, left: 8, right: 8, zIndex: 5,
                    display: 'flex', flexDirection: 'column', gap: 2,
                    background: tokens.colorNeutralBackground1,
                    borderRadius: tokens.borderRadiusMedium,
                    padding: '4px 8px',
                    opacity: 0.85,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Caption2 style={{ color: tokens.colorNeutralForeground3, fontSize: 9, width: 30 }}>Detail</Caption2>
                      <Slider
                        size="small"
                        min={0}
                        max={4}
                        step={1}
                        value={detailIdx}
                        onChange={(_e, data) => {
                          setDetailIdx(data.value);
                          try { localStorage.setItem('kbe-detail', String(data.value)); } catch { /* */ }
                        }}
                        style={{ flex: 1 }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Caption2 style={{ color: tokens.colorNeutralForeground3, fontSize: 9, width: 30 }}>Zoom</Caption2>
                      <Slider
                        size="small"
                        min={20}
                        max={200}
                        step={10}
                        value={sidebarZoom}
                        onChange={(_e, data) => {
                          setSidebarZoom(data.value);
                          sidebarNetworkRef.current?.moveTo({
                            scale: data.value / 100,
                            animation: { duration: 150, easingFunction: 'easeInOutQuad' },
                          });
                        }}
                        style={{ flex: 1 }}
                      />
                    </div>
                  </div>
                </div>

                {/* Split resize handle */}
                <div
                  onPointerDown={handleSplitResizeStart}
                  style={{
                    flexShrink: 0,
                    height: 5,
                    cursor: 'row-resize',
                    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
                  }}
                />

                {/* Connections panel */}
                <div style={{ flex: 1, minHeight: '10%', overflowY: 'auto', padding: `0 ${tokens.spacingHorizontalS}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: `${tokens.spacingVerticalS} 0` }}>
                    <Button
                      appearance="subtle"
                      size="small"
                      icon={<GridRegular />}
                      onClick={() => { window.location.hash = '#/overview'; }}
                      title="Card overview"
                      style={{ marginRight: 'auto' }}
                    >
                      Cards
                    </Button>
                    <Caption2 style={{ color: tokens.colorNeutralForeground3, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                      Connections
                    </Caption2>
                    <Caption2 style={{ color: tokens.colorNeutralForeground3 }}>{relatedNodes.length}</Caption2>
                  </div>
                  {currentNode && relatedNodes.length > 0 ? (
                    relatedNodes.map(n => {
                      const clusterObj = graph.clusters.find(c => c.id === n.cluster);
                      return (
                        <a
                          key={n.id}
                          href={`#/node/${encodeURIComponent(n.id)}`}
                          style={{ textDecoration: 'none', color: 'inherit', display: 'block', marginBottom: 2 }}
                        >
                          <Card
                            appearance="subtle"
                            size="small"
                            style={{ padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}` }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <NodeVisual node={n} mode={config.visuals.mode} surface="hud-thumb" source={config.source} clusterColor={clusterObj?.color} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <Body1Strong style={{ display: 'block', fontSize: 13, lineHeight: '18px' }} className={styles.relatedTitle}>{n.title}</Body1Strong>
                                {n.rawContent && (
                                  <Caption2 style={{ color: tokens.colorNeutralForeground3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {n.rawContent.replace(/[#*`>\-[\]]/g, '').trim().substring(0, 120)}
                                  </Caption2>
                                )}
                              </div>
                              {clusterObj && (
                                <span style={{ width: 3, height: 28, borderRadius: 2, background: clusterObj.color, flexShrink: 0 }} />
                              )}
                            </div>
                          </Card>
                        </a>
                      );
                    })
                  ) : currentNode ? (
                    <span className={styles.placeholder}>No connections</span>
                  ) : (
                    <span className={styles.placeholder}>Select a node to see connections</span>
                  )}
                </div>

                {/* Compact tools strip */}
                <div style={{ flexShrink: 0, padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`, display: 'flex', flexDirection: 'column', gap: 4, borderTop: `1px solid ${tokens.colorNeutralStroke2}` }}>
                  {currentNode && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Caption2 style={{ width: 32, flexShrink: 0 }}>Aa</Caption2>
                      <Slider className={styles.slider} min={0} max={6} step={1} value={fontSize} onChange={(_e, data) => setFontSize(data.value)} title={`Font size: ${FONT_SIZES[fontSize]}rem`} />
                      <Caption2 style={{ width: 38, flexShrink: 0 }}>Width</Caption2>
                      <Slider className={styles.slider} min={0} max={4} step={1} value={colWidth} onChange={(_e, data) => setColWidth(data.value)} title={`Column width: ${COL_WIDTHS[colWidth]}`} />
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {themeButtons}
                    <span style={{ flex: 1 }} />
                    <Button appearance={dock === 'left' ? 'primary' : 'subtle'} size="small" icon={<PanelLeftRegular />} onClick={() => handleDockChange('left')} title="Dock left" />
                    <Button appearance={dock === 'right' ? 'primary' : 'subtle'} size="small" icon={<PanelRightRegular />} onClick={() => handleDockChange('right')} title="Dock right" />
                    <Button appearance="subtle" size="small" icon={<PanelBottomRegular />} onClick={() => handleDockChange('bottom')} title="Dock bottom" />
                    <Button appearance="subtle" size="small" icon={<PanelTopExpandRegular />} onClick={() => handleDockChange('top')} title="Dock top" />
                  </div>
                </div>
              </>
            ) : (
              /* ── Horizontal layout (top/bottom dock) ── */
              <>
              {/* Minimap panel */}
              <div className={styles.panelLeft}>
                <canvas
                  ref={canvasRef}
                  className={styles.minimap}
                  onClick={() => setMapExpanded(true)}
                  title="Expand constellation"
                />
                <Caption2 style={{ marginTop: 4, color: tokens.colorNeutralForeground3 }}>MAP</Caption2>
              </div>

              {/* Center: Navigation */}
              <div className={styles.panelCenter}>
              <div className={styles.navRow}>
                <Button
                  appearance="outline"
                  size="small"
                  icon={<MapRegular />}
                  onClick={() => setMapExpanded(true)}
                >
                  MAP
                </Button>
                <Button
                  appearance="outline"
                  size="small"
                  icon={<GridRegular />}
                  onClick={() => { window.location.hash = '#/overview'; }}
                >
                  Cards
                </Button>
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<ChevronLeftRegular />}
                  onClick={goPrev}
                  disabled={!currentNode}
                  title="Previous node (←)"
                />
                {currentNode ? (
                  <div className={styles.currentNode}>
                    {currentNode.emoji && isFluentIconName(currentNode.emoji) ? (
                      (() => { const Icon = FLUENT_ICONS[currentNode.emoji]; return <Icon style={{ fontSize: 20 }} />; })()
                    ) : (
                      <span style={{ fontSize: tokens.fontSizeBase500 }}>{currentNode.emoji ?? ''}</span>
                    )}
                    <Body1Strong className={styles.currentTitle}>{currentNode.title}</Body1Strong>
                    <Caption1 style={{ color: tokens.colorNeutralForeground3, whiteSpace: 'nowrap' }}>
                      {currentNode.cluster}
                    </Caption1>
                  </div>
                ) : (
                  <span className={styles.placeholder}>Click any node to begin reading</span>
                )}
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<ChevronRightRegular />}
                  onClick={goNext}
                  disabled={!currentNode}
                  title="Next node (→)"
                />
              </div>

              {currentNode && (
              <div className={styles.relatedStrip}>
                <Caption2 style={{ color: tokens.colorNeutralForeground3, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0, lineHeight: '32px' }}>
                  Related
                </Caption2>
                {relatedNodes.length > 0 ? (
                  relatedNodes.map(n => (
                    <a
                      key={n.id}
                      href={`#/node/${encodeURIComponent(n.id)}`}
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <Card
                        appearance="subtle"
                        size="small"
                        className={styles.relatedCard}
                      >
                        <NodeVisual
                          node={n}
                          mode={config.visuals.mode}
                          surface="hud-thumb"
                          source={config.source}
                          clusterColor={graph.clusters.find(c => c.id === n.cluster)?.color}
                        />
                        <Caption1 className={styles.relatedTitle}>{n.title}</Caption1>
                      </Card>
                    </a>
                  ))
                ) : (
                  <span className={styles.placeholder} style={{ fontSize: tokens.fontSizeBase200 }}>No related nodes</span>
                )}
              </div>
              )}
            </div>

            {/* Right: Reading Tools */}
            <div className={styles.panelRight}>
              <div className={styles.toolRow}>
                <Caption2 className={styles.toolLabel}>Theme</Caption2>
                {themeButtons}
              </div>

              <div className={styles.toolRow}>
                <Caption2 className={styles.toolLabel}>Dock</Caption2>
                <div className={styles.dockBtnGroup}>
                  <Button
                    appearance={dock === 'bottom' ? 'primary' : 'subtle'}
                    size="small"
                    icon={<PanelBottomRegular />}
                    onClick={() => handleDockChange('bottom')}
                    title="Dock bottom"
                  />
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<PanelLeftRegular />}
                    onClick={() => handleDockChange('left')}
                    title="Dock left"
                  />
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<PanelRightRegular />}
                    onClick={() => handleDockChange('right')}
                    title="Dock right"
                  />
                  <Button
                    appearance={dock === 'top' ? 'primary' : 'subtle'}
                    size="small"
                    icon={<PanelTopExpandRegular />}
                    onClick={() => handleDockChange('top')}
                    title="Dock top"
                  />
                </div>
              </div>

              {currentNode && (
              <>
              <div className={styles.toolRow}>
                <Caption2 className={styles.toolLabel}>Aa</Caption2>
                <Slider
                  className={styles.slider}
                  min={0}
                  max={6}
                  step={1}
                  value={fontSize}
                  onChange={(_e, data) => setFontSize(data.value)}
                  title={`Font size: ${FONT_SIZES[fontSize]}rem`}
                />
              </div>

              <div className={styles.toolRow}>
                <Caption2 className={styles.toolLabel}>Width</Caption2>
                <Slider
                  className={styles.slider}
                  min={0}
                  max={4}
                  step={1}
                  value={colWidth}
                  onChange={(_e, data) => setColWidth(data.value)}
                  title={`Column width: ${COL_WIDTHS[colWidth]}`}
                />
              </div>
              </>
              )}
            </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
