import { useEffect, useRef, useState, useCallback } from 'react';
import { Network } from 'vis-network/standalone';
import { DataSet } from 'vis-data';
import {
  makeStyles,
  tokens,
  Button,
  Divider,
  Slider,
  Card,
  Badge,
  Body1Strong,
  Caption1,
  Caption2,
} from '@fluentui/react-components';
import {
  ChevronLeftRegular,
  ChevronRightRegular,
  DismissRegular,
  MapRegular,
  WeatherMoonRegular,
  WeatherSunnyRegular,
} from '@fluentui/react-icons';
import type { KBGraph, KBConfig, KBNode, Theme } from '../types';
import { NodeVisual } from './NodeVisual';
import { getVisNodeConfig } from './NodeVisual';
import { getNodeDegrees } from '../engine/graph';

interface HUDProps {
  graph: KBGraph;
  config: KBConfig;
  currentNodeId: string | null;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

const FONT_SIZES = [0.92, 1.0, 1.08, 1.18, 1.3];
const COL_WIDTHS = [580, 680, 780, 960, 1200];

// Fluent 2 dark-theme hex values for vis-network / canvas
const LABEL_COLOR = '#d6d6d6';
const LABEL_STROKE_COLOR = '#1f1f1f';
const EDGE_COLOR = '#383838';
const EDGE_HOVER_COLOR = '#5c5c5c';
const MINIMAP_EDGE_COLOR = 'rgba(255, 255, 255, 0.06)';
const HIGHLIGHT_COLOR = '#479ef5';  // colorBrandForeground1
const FONT_FAMILY = `'Segoe UI', 'Segoe UI Web (West European)', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', sans-serif`;

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

const useStyles = makeStyles({
  hud: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: '168px',
    backgroundColor: tokens.colorNeutralBackground1,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    display: 'flex',
    zIndex: 100,
    color: tokens.colorNeutralForeground1,
  },
  panelLeft: {
    width: '232px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    flexShrink: 0,
  },
  panelCenter: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    gap: tokens.spacingVerticalS,
  },
  panelRight: {
    width: '240px',
    display: 'flex',
    flexDirection: 'column',
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    flexShrink: 0,
    gap: tokens.spacingVerticalSNudge,
    justifyContent: 'center',
  },
  minimap: {
    width: '200px',
    height: '140px',
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
    overflowX: 'auto',
    overflowY: 'hidden',
    flex: 1,
    minHeight: 0,
    scrollbarWidth: 'thin',
  },
  relatedCard: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    flexShrink: 0,
    minWidth: '140px',
    textDecoration: 'none',
    color: 'inherit',
    cursor: 'pointer',
  },
  relatedTitle: {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    maxWidth: '140px',
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
    zIndex: 200,
    backgroundColor: tokens.colorBackgroundOverlay,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animationName: {
      from: { opacity: 0 },
      to: { opacity: 1 },
    },
    animationDuration: '0.25s',
    animationTimingFunction: 'ease-out',
  },
  overlayInner: {
    width: '90vw',
    height: '80vh',
    maxWidth: '1200px',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusXLarge,
    overflow: 'hidden',
  },
  overlayHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
  },
  overlayLegend: {
    display: 'flex',
    gap: tokens.spacingHorizontalL,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalXL}`,
    flexWrap: 'wrap',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
  },
  overlayGraph: {
    flex: 1,
    minHeight: 0,
  },
});

export function HUD({ graph, config, currentNodeId, theme, onThemeChange }: HUDProps) {
  const styles = useStyles();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const overlayNetworkRef = useRef<Network | null>(null);

  const [fontSize, setFontSize] = useState(() => readPersisted('kbe-font-size', 1));
  const [colWidth, setColWidth] = useState(() => readPersisted('kbe-col-width', 2));
  const [mapExpanded, setMapExpanded] = useState(false);

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
    document.documentElement.style.setProperty('--prose-max-width', `${COL_WIDTHS[colWidth]}px`);
    localStorage.setItem('kbe-col-width', String(colWidth));
  }, [colWidth]);

  // Minimap layout positions via hidden vis-network
  const minimapPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = 'position:absolute;left:-9999px;width:400px;height:280px;';
    document.body.appendChild(tempDiv);

    const degrees = getNodeDegrees(graph);
    const clusterColorMap = new Map(graph.clusters.map(c => [c.id, c.color]));

    const nodeData = graph.nodes.map(n => {
      const deg = degrees.get(n.id) ?? 0;
      const size = Math.min(10 + deg * 3, 30);
      const color = clusterColorMap.get(n.cluster) ?? '#888'; // data fallback, intentionally not a theme token
      return {
        id: n.id,
        label: '',
        size,
        color: { background: color + '88', border: color },
        borderWidth: 1,
      };
    });

    const edgeData = graph.edges.map((e, i) => ({
      id: `e${i}`,
      from: e.from,
      to: e.to,
    }));

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

    net.once('stabilized', () => {
      const positions = net.getPositions();
      const posMap = new Map<string, { x: number; y: number }>();
      for (const [id, pos] of Object.entries(positions)) {
        posMap.set(id, pos as { x: number; y: number });
      }
      minimapPositionsRef.current = posMap;
      net.destroy();
      document.body.removeChild(tempDiv);
      drawMinimap();
    });

    return () => {
      try { net.destroy(); } catch { /* already destroyed */ }
      try { document.body.removeChild(tempDiv); } catch { /* already removed */ }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  const drawMinimap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const posMap = minimapPositionsRef.current;
    if (posMap.size === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const W = 200, H = 140;
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
    ctx.strokeStyle = MINIMAP_EDGE_COLOR;
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

    // Draw nodes
    const clusterColorMap = new Map(graph.clusters.map(c => [c.id, c.color]));
    for (const node of graph.nodes) {
      const pos = posMap.get(node.id);
      if (!pos) continue;
      const [cx, cy] = toCanvas(pos.x, pos.y);
      const isCurrent = node.id === currentNodeId;
      const color = clusterColorMap.get(node.cluster) ?? '#888'; // data fallback, intentionally not a theme token
      ctx.beginPath();
      ctx.arc(cx, cy, isCurrent ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = isCurrent ? HIGHLIGHT_COLOR : color;
      ctx.fill();
      if (isCurrent) {
        ctx.strokeStyle = HIGHLIGHT_COLOR;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }, [graph, currentNodeId]);

  useEffect(() => { drawMinimap(); }, [drawMinimap]);

  // Expanded map overlay (vis-network)
  useEffect(() => {
    if (!mapExpanded || !overlayRef.current) return;

    const degrees = getNodeDegrees(graph);
    const clusterColorMap = new Map(graph.clusters.map(c => [c.id, c.color]));

    const nodeData = graph.nodes.map(n => {
      const deg = degrees.get(n.id) ?? 0;
      const size = Math.min(18 + deg * 4, 45);
      const color = clusterColorMap.get(n.cluster) ?? '#9A8A78'; // data fallback, intentionally not a theme token
      const visConfig = getVisNodeConfig(n, config.visuals.mode, config.source, color, size);
      return {
        id: n.id,
        label: n.title,
        title: `${n.title}\n${deg} connection${deg === 1 ? '' : 's'}`,
        font: { color: LABEL_COLOR, face: FONT_FAMILY, size: 11, strokeWidth: 3, strokeColor: LABEL_STROKE_COLOR },
        ...visConfig,
      };
    });

    const edgeData = graph.edges.map((e, i) => ({
      id: `e${i}`,
      from: e.from,
      to: e.to,
      title: e.description,
      color: { color: EDGE_COLOR, hover: EDGE_HOVER_COLOR, highlight: EDGE_HOVER_COLOR },
      width: 1,
      dashes: [3, 5],
    }));

    const nodes = new DataSet(nodeData);
    const edges = new DataSet(edgeData);

    const net = new Network(overlayRef.current, { nodes, edges }, {
      physics: {
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -60,
          centralGravity: 0.015,
          springLength: 100,
          springConstant: 0.08,
          damping: 0.4,
        },
        stabilization: { iterations: 200 },
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        navigationButtons: false,
        keyboard: false,
        dragView: true,
        zoomView: true,
      },
      edges: {
        smooth: { enabled: true, type: 'continuous', roundness: 0.5 },
      },
    });

    net.on('click', (params: { nodes: string[] }) => {
      if (params.nodes.length > 0) {
        setMapExpanded(false);
        window.location.hash = `/node/${encodeURIComponent(params.nodes[0])}`;
      }
    });

    if (currentNodeId) {
      net.once('stabilized', () => {
        net.selectNodes([currentNodeId]);
        net.focus(currentNodeId, { scale: 1.2, animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
      });
    }

    overlayNetworkRef.current = net;

    return () => {
      net.destroy();
      overlayNetworkRef.current = null;
    };
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

  return (
    <>
      {/* Constellation overlay */}
      {mapExpanded && (
        <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) setMapExpanded(false); }}>
          <div className={styles.overlayInner}>
            <div className={styles.overlayHeader}>
              <Body1Strong>Constellation</Body1Strong>
              <Button
                appearance="subtle"
                icon={<DismissRegular />}
                onClick={() => setMapExpanded(false)}
                aria-label="Close"
              />
            </div>
            <div className={styles.overlayLegend}>
              {graph.clusters.map(c => (
                <Badge
                  key={c.id}
                  appearance="outline"
                  color="informative"
                  size="small"
                  icon={
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: c.color,
                        display: 'inline-block',
                      }}
                    />
                  }
                >
                  {c.name}
                </Badge>
              ))}
            </div>
            <div ref={overlayRef} className={styles.overlayGraph} />
          </div>
        </div>
      )}

      <div className={styles.hud}>
        {/* Left: Minimap */}
        <div className={styles.panelLeft}>
          <canvas
            ref={canvasRef}
            className={styles.minimap}
            width={200}
            height={140}
            onClick={() => setMapExpanded(true)}
            title="Expand constellation"
          />
          <Caption2 style={{ marginTop: 4, color: tokens.colorNeutralForeground3 }}>MAP</Caption2>
        </div>

        <Divider vertical />

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
                <span style={{ fontSize: tokens.fontSizeBase500 }}>{currentNode.emoji ?? '📌'}</span>
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
          <div className={styles.navRow} style={{ alignItems: 'flex-start' }}>
            <Caption2 style={{ color: tokens.colorNeutralForeground3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Related
            </Caption2>
            <div className={styles.relatedStrip}>
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
          </div>
          )}
        </div>

        <Divider vertical />

        {/* Right: Reading Tools */}
        <div className={styles.panelRight}>
          <div className={styles.toolRow}>
            <Caption2 className={styles.toolLabel}>Theme</Caption2>
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
              title={`Column width: ${COL_WIDTHS[colWidth]}px`}
            />
          </div>
          </>
          )}
        </div>
      </div>
    </>
  );
}
