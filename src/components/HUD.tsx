import { useEffect, useRef, useState, useCallback } from 'react';
import { Network } from 'vis-network/standalone';
import { DataSet } from 'vis-data';
import type { KBGraph, KBConfig, KBNode, Theme } from '../types';
import { NodeVisual } from './NodeVisual';
import { getVisNodeConfig } from './NodeVisual';
import { getNodeDegrees } from '../engine/graph';
import '../styles/hud.css';

interface HUDProps {
  graph: KBGraph;
  config: KBConfig;
  currentNodeId: string | null;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

const FONT_SIZES = [0.92, 1.0, 1.08, 1.18, 1.3];
const COL_WIDTHS = [580, 680, 780, 960, 1200];

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

export function HUD({ graph, config, currentNodeId, theme, onThemeChange }: HUDProps) {
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

  // Draw minimap using force-directed positions via a hidden vis-network
  const minimapPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    // Compute positions using a temporary off-screen vis-network
    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = 'position:absolute;left:-9999px;width:400px;height:280px;';
    document.body.appendChild(tempDiv);

    const degrees = getNodeDegrees(graph);
    const clusterColorMap = new Map(graph.clusters.map(c => [c.id, c.color]));

    const nodeData = graph.nodes.map(n => {
      const deg = degrees.get(n.id) ?? 0;
      const size = Math.min(10 + deg * 3, 30);
      const color = clusterColorMap.get(n.cluster) ?? '#888';
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

    // Compute bounding box
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
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
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
      const color = clusterColorMap.get(node.cluster) ?? '#888';
      ctx.beginPath();
      ctx.arc(cx, cy, isCurrent ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = isCurrent ? '#E8C350' : color;
      ctx.fill();
      if (isCurrent) {
        ctx.strokeStyle = '#E8C350';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }, [graph, currentNodeId]);

  // Redraw minimap when current node changes
  useEffect(() => { drawMinimap(); }, [drawMinimap]);

  // Expanded map overlay (vis-network instance)
  useEffect(() => {
    if (!mapExpanded || !overlayRef.current) return;

    const degrees = getNodeDegrees(graph);
    const clusterColorMap = new Map(graph.clusters.map(c => [c.id, c.color]));

    const nodeData = graph.nodes.map(n => {
      const deg = degrees.get(n.id) ?? 0;
      const size = Math.min(18 + deg * 4, 45);
      const color = clusterColorMap.get(n.cluster) ?? '#9A8A78';
      const visConfig = getVisNodeConfig(n, config.visuals.mode, config.source, color, size);
      return {
        id: n.id,
        label: n.title,
        title: `${n.title}\n${deg} connection${deg === 1 ? '' : 's'}`,
        font: { color: '#C8B8A8', face: 'General Sans, sans-serif', size: 11, strokeWidth: 3, strokeColor: '#0D0D0D' },
        ...visConfig,
      };
    });

    const edgeData = graph.edges.map((e, i) => ({
      id: `e${i}`,
      from: e.from,
      to: e.to,
      title: e.description,
      color: { color: '#2A2620', hover: '#4A4438', highlight: '#4A4438' },
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

    // Highlight current node
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
      {/* ── Constellation overlay (expanded minimap) ─── */}
      {mapExpanded && (
        <div className="hud-overlay" onClick={(e) => { if (e.target === e.currentTarget) setMapExpanded(false); }}>
          <div className="hud-overlay-inner">
            <div className="hud-overlay-header">
              <span className="hud-overlay-title">Constellation</span>
              <button className="hud-overlay-close" onClick={() => setMapExpanded(false)}>×</button>
            </div>
            <div className="hud-overlay-legend">
              {graph.clusters.map(c => (
                <span key={c.id} className="hud-overlay-legend-item">
                  <span className="hud-overlay-legend-dot" style={{ background: c.color }} />
                  {c.name}
                </span>
              ))}
            </div>
            <div ref={overlayRef} className="hud-overlay-graph" />
          </div>
        </div>
      )}

      <div className="hud">
        {/* ── Left: Minimap ─── */}
        <div className="hud-panel hud-panel--left">
          <canvas
            ref={canvasRef}
            className="hud-minimap"
            width={200}
            height={140}
            onClick={() => setMapExpanded(true)}
            title="Expand constellation"
          />
          <span className="hud-minimap-label">MAP</span>
        </div>

        {/* ── Center: Navigation ─── */}
        <div className="hud-panel hud-panel--center">
          <div className="hud-nav-row">
            <button className="hud-btn" onClick={() => setMapExpanded(true)}>MAP</button>
            <button
              className="hud-btn hud-btn--nav"
              onClick={goPrev}
              disabled={!currentNode}
              title="Previous node (←)"
            >◀</button>
            {currentNode ? (
              <div className="hud-current-node">
                <span style={{ fontSize: 20 }}>{currentNode.emoji ?? '📌'}</span>
                <span className="hud-current-title">{currentNode.title}</span>
                <span className="hud-current-cluster">{currentNode.cluster}</span>
              </div>
            ) : (
              <span className="hud-placeholder">Click any node to begin reading</span>
            )}
            <button
              className="hud-btn hud-btn--nav"
              onClick={goNext}
              disabled={!currentNode}
              title="Next node (→)"
            >▶</button>
          </div>

          <div className="hud-nav-row" style={{ alignItems: 'flex-start' }}>
            <span className="hud-related-label">Related</span>
            <div className="hud-related-strip">
              {relatedNodes.length > 0 ? (
                relatedNodes.map(n => (
                  <a
                    key={n.id}
                    className="hud-related-card"
                    href={`#/node/${encodeURIComponent(n.id)}`}
                  >
                    <NodeVisual
                      node={n}
                      mode={config.visuals.mode}
                      surface="hud-thumb"
                      source={config.source}
                    />
                    <span className="hud-related-title">{n.title}</span>
                  </a>
                ))
              ) : currentNode ? (
                <span className="hud-placeholder" style={{ fontSize: '0.78rem' }}>No related nodes</span>
              ) : null}
            </div>
          </div>
        </div>

        {/* ── Right: Reading Tools ─── */}
        <div className="hud-panel hud-panel--right">
          <div className="hud-tool-row">
            <span className="hud-tool-label">Theme</span>
            {(['dark', 'light', 'sepia'] as Theme[]).map(t => (
              <button
                key={t}
                className={`hud-theme-btn hud-theme-btn--${t} ${theme === t ? 'hud-theme-btn--active' : ''}`}
                onClick={() => onThemeChange(t)}
                title={t}
              />
            ))}
          </div>

          <div className="hud-tool-row">
            <span className="hud-tool-label">Aa</span>
            <input
              type="range"
              className="hud-range"
              min={0}
              max={4}
              step={1}
              value={fontSize}
              onChange={e => setFontSize(Number(e.target.value))}
              title={`Font size: ${FONT_SIZES[fontSize]}rem`}
            />
          </div>

          <div className="hud-tool-row">
            <span className="hud-tool-label">↔</span>
            <input
              type="range"
              className="hud-range"
              min={0}
              max={4}
              step={1}
              value={colWidth}
              onChange={e => setColWidth(Number(e.target.value))}
              title={`Column width: ${COL_WIDTHS[colWidth]}px`}
            />
          </div>
        </div>
      </div>
    </>
  );
}
