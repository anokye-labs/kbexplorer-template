import { useEffect } from 'react';
import type { KBGraph, Theme } from '../types';
import { nextTheme, type ThemeMode } from './useTheme';

/**
 * Global keyboard shortcuts.
 *
 * t        → cycle theme
 * /        → overview (#/)
 * g        → graph (#/graph)
 * Escape   → back to overview
 * ←/→      → prev/next node (reading view)
 */
export function useKeyboardNav(
  graph: KBGraph | null,
  setTheme: (t: Theme) => void,
): void {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      switch (e.key) {
        case 't': {
          // Read current theme from localStorage since we no longer use body classes
          const stored = localStorage.getItem('kbe-theme') as ThemeMode | null;
          const current: ThemeMode = stored === 'light' ? 'light' : 'dark';
          setTheme(nextTheme(current));
          break;
        }
        case '/':
          e.preventDefault();
          window.location.hash = '#/';
          break;
        case 'g':
          window.location.hash = '#/graph';
          break;
        case 'Escape':
          window.location.hash = '#/';
          break;
        case 'ArrowLeft':
        case 'ArrowRight': {
          if (!graph) break;
          const hash = window.location.hash;
          const match = hash.match(/#\/node\/(.+)/);
          if (!match) break;
          const currentId = decodeURIComponent(match[1]);
          const idx = graph.nodes.findIndex(n => n.id === currentId);
          if (idx < 0) break;
          const next = e.key === 'ArrowRight'
            ? (idx + 1) % graph.nodes.length
            : (idx - 1 + graph.nodes.length) % graph.nodes.length;
          window.location.hash = `#/node/${encodeURIComponent(graph.nodes[next].id)}`;
          break;
        }
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [graph, setTheme]);
}
