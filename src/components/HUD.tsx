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
  DismissRegular,
  MapRegular,
  WeatherMoonRegular,
  WeatherSunnyRegular,
  BookRegular,
} from '@fluentui/react-icons';
import type { KBGraph, KBConfig, KBNode, Theme } from '../types';
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

const FONT_SIZES = [0.92, 1.0, 1.08, 1.18, 1.3];
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
    width: '90vw',
    height: '85vh',
    maxWidth: '1400px',
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [fontSize, setFontSize] = useState(() => readPersisted('kbe-font-size', 1));
  const [colWidth, setColWidth] = useState(() => readPersisted('kbe-col-width', 2));
  const [mapExpanded, setMapExpanded] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => readPersisted('kbe-sidebar-w', 25));
  const resizeRef = useRef<{ startX: number; startW: number } | null>(null);

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

  const currentNode = currentNodeId
    ? graph.nodes.find(n => n.id === currentNodeId) ?? null
    : null;

  const currentIdx = currentNode
    ? graph.nodes.findIndex(n => n.id === currentNodeId)
    : -1;

  const relatedIds = currentNodeId ? (graph.related[currentNodeId] ?? []) : [];
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

  // Minimap layout positions via hidden vis-network
  const [minimapPositions, setMinimapPositions] = useState<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    const cleanup = computeGraphPositions(graph, (posMap) => {
      setMinimapPositions(posMap);
    });
    return cleanup;
  }, [graph]);

  const drawMinimap = useCallback(() => {
    const canvas = canvasRef.current;
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
    for (const edge of graph.edges) {
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
    const clusterColorMap = new Map(graph.clusters.map(c => [c.id, c.color]));

    for (const node of graph.nodes) {
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
  }, [graph, currentNodeId, theme, dock, minimapPositions]);

  useEffect(() => { const t = setTimeout(() => drawMinimap(), 50); return () => clearTimeout(t); }, [drawMinimap]);

  // Expanded map overlay (vis-network)
  useEffect(() => {
    if (!mapExpanded || !overlayRef.current) return;

    const { network } = createGraphNetwork({
      container: overlayRef.current,
      graph,
      isDark: theme === 'dark',
      onNodeClick: (id) => {
        setMapExpanded(false);
        window.location.hash = `/node/${encodeURIComponent(id)}`;
      },
      focusNodeId: currentNodeId,
      fitOnStabilize: !currentNodeId,
    });

    return () => { network.destroy(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapExpanded, graph, config]);

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

  const isVertical = dock === 'left' || dock === 'right';
  const contentDirection: 'column' | 'row' = isVertical ? 'column' : 'row';

  const hudContainerStyle: React.CSSProperties = {
    transition: isVertical ? 'width 0.3s ease-out' : 'height 0.3s ease-out',
    ...(dock === 'bottom' ? {
      bottom: 0, left: 0, right: 0,
      height: collapsed ? 40 : 148,
      borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    } : dock === 'top' ? {
      top: 0, left: 0, right: 0,
      height: collapsed ? 40 : 148,
      borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    } : dock === 'left' ? {
      top: 0, left: 0, bottom: 0,
      width: collapsed ? 40 : `${sidebarWidth}vw`,
      borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    } : {
      top: 0, right: 0, bottom: 0,
      width: collapsed ? 40 : `${sidebarWidth}vw`,
      borderLeft: `1px solid ${tokens.colorNeutralStroke2}`,
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
            <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}>
              <Button
                appearance="subtle"
                icon={<DismissRegular />}
                onClick={() => setMapExpanded(false)}
                aria-label="Close"
              />
            </div>
            <Card size="small" style={{ position: 'absolute', bottom: 16, left: 16, zIndex: 10 }}>
              <CardHeader header={<Caption1><strong>Clusters</strong></Caption1>} />
              {graph.clusters.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 12px' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                  <Caption1>{c.name}</Caption1>
                </div>
              ))}
            </Card>
          </div>
        </div>
      )}

      <div className={styles.hud} style={hudContainerStyle}>
        {collapsed ? (
          <div className={styles.collapsedBar}>
            <Button
              size="small"
              appearance="subtle"
              icon={expandIcon}
              onClick={() => handleCollapse(false)}
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
            <div style={isVertical
              ? { padding: 8, paddingTop: 36, flexShrink: 0 }
              : { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: tokens.spacingVerticalXS, flexShrink: 0 }
            }>
              {isVertical ? (
                <div style={{ position: 'relative', borderRadius: tokens.borderRadiusMedium, border: `1px solid ${tokens.colorNeutralStroke2}`, overflow: 'hidden' }}>
                  <canvas
                    ref={canvasRef}
                    style={{ width: '100%', height: 220, cursor: 'pointer', display: 'block' }}
                    onClick={() => setMapExpanded(true)}
                    title="Expand constellation"
                  />
                  <div style={{ position: 'absolute', top: 6, left: 6, fontSize: 11, lineHeight: '18px', opacity: 0.85 }}>
                    {graph.clusters.map(c => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                        <span style={{ color: tokens.colorNeutralForeground3 }}>{c.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <canvas
                    ref={canvasRef}
                    className={styles.minimap}
                    onClick={() => setMapExpanded(true)}
                    title="Expand constellation"
                  />
                  <Caption2 style={{ marginTop: 4, color: tokens.colorNeutralForeground3 }}>MAP</Caption2>
                </>
              )}
            </div>

            {/* Resize handle (sidebar only) */}
            {isVertical && (
              <div
                onPointerDown={handleResizeStart}
                style={{
                  position: 'absolute',
                  top: 0,
                  [dock === 'left' ? 'right' : 'left']: 0,
                  width: 5,
                  height: '100%',
                  cursor: 'col-resize',
                  zIndex: 10,
                }}
              />
            )}

            {isVertical ? (
              /* ── Sidebar: connections + compact tools ── */
              <>
                <div style={{ flex: 1, overflowY: 'auto', padding: `0 ${tokens.spacingHorizontalS}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: `${tokens.spacingVerticalS} 0` }}>
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
                              <NodeVisual node={n} mode={config.visuals.mode} surface="hud-thumb" source={config.source} />
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
                <div style={{ flexShrink: 0, padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`, display: 'flex', alignItems: 'center', gap: 6, borderTop: `1px solid ${tokens.colorNeutralStroke2}` }}>
                  {themeButtons}
                  <span style={{ flex: 1 }} />
                  <Button appearance={dock === 'left' ? 'primary' : 'subtle'} size="small" icon={<ArrowLeftRegular />} onClick={() => handleDockChange('left')} title="Dock left" />
                  <Button appearance={dock === 'right' ? 'primary' : 'subtle'} size="small" icon={<ArrowRightRegular />} onClick={() => handleDockChange('right')} title="Dock right" />
                  <Button appearance="subtle" size="small" icon={<ArrowDownRegular />} onClick={() => handleDockChange('bottom')} title="Dock bottom" />
                </div>
              </>
            ) : (
              /* ── Horizontal layout (top/bottom dock) ── */
              <>

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
                    icon={<ArrowDownRegular />}
                    onClick={() => handleDockChange('bottom')}
                    title="Dock bottom"
                  />
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<ArrowLeftRegular />}
                    onClick={() => handleDockChange('left')}
                    title="Dock left"
                  />
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<ArrowRightRegular />}
                    onClick={() => handleDockChange('right')}
                    title="Dock right"
                  />
                  <Button
                    appearance={dock === 'top' ? 'primary' : 'subtle'}
                    size="small"
                    icon={<ArrowUpRegular />}
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
                  max={4}
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
