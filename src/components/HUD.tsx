import { useEffect, useRef, useState, useCallback } from 'react';
import type { KBGraph, KBConfig, KBNode, Theme } from '../types';
import { NodeVisual } from './NodeVisual';
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

  const [fontSize, setFontSize] = useState(() => readPersisted('kbe-font-size', 1));
  const [colWidth, setColWidth] = useState(() => readPersisted('kbe-col-width', 1));

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

  // Draw minimap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = 200 * dpr;
    canvas.height = 140 * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, 200, 140);

    const nodes = graph.nodes;
    if (nodes.length === 0) return;

    // Deterministic layout: hash-based positioning
    const positions = nodes.map((n, i) => {
      const angle = (i / nodes.length) * Math.PI * 2;
      const radius = 45 + (i % 3) * 12;
      return {
        x: 100 + Math.cos(angle) * radius,
        y: 70 + Math.sin(angle) * radius,
        node: n,
      };
    });

    const posMap = new Map(positions.map(p => [p.node.id, p]));

    // Draw edges
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 0.5;
    for (const edge of graph.edges) {
      const from = posMap.get(edge.from);
      const to = posMap.get(edge.to);
      if (from && to) {
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }
    }

    // Draw nodes
    const clusterColorMap = new Map(graph.clusters.map(c => [c.id, c.color]));
    for (const p of positions) {
      const color = clusterColorMap.get(p.node.cluster) ?? '#888';
      const isCurrent = p.node.id === currentNodeId;
      ctx.beginPath();
      ctx.arc(p.x, p.y, isCurrent ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = isCurrent ? '#E8C350' : color;
      ctx.fill();
      if (isCurrent) {
        ctx.strokeStyle = '#E8C350';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }, [graph, currentNodeId]);

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
    <div className="hud">
      {/* ── Left: Minimap ─── */}
      <div className="hud-panel hud-panel--left">
        <canvas
          ref={canvasRef}
          className="hud-minimap"
          width={200}
          height={140}
          onClick={() => navigateTo('#/graph')}
          title="Open graph view"
        />
      </div>

      {/* ── Center: Navigation ─── */}
      <div className="hud-panel hud-panel--center">
        <div className="hud-nav-row">
          <button className="hud-btn" onClick={() => navigateTo('#/graph')}>MAP</button>
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
        {/* Theme switcher */}
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

        {/* Font size */}
        <div className="hud-tool-row">
          <span className="hud-tool-label">Font</span>
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

        {/* Column width */}
        <div className="hud-tool-row">
          <span className="hud-tool-label">Width</span>
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
  );
}
