import { useState, useEffect } from 'react';
import type { KBGraph, KBConfig, SourceConfig } from '../types';
import { detectLocalMode, loadLocalKnowledgeBase } from '../engine/local-loader';
import { loadRemoteKnowledgeBase } from '../engine/remote-loader';
import { isDemoEntitiesEnabled, injectDemoEntities } from '../engine/demo-entities';

export type LoadingState =
  | { status: 'loading' }
  | { status: 'ready'; graph: KBGraph; config: KBConfig }
  | { status: 'error'; error: string };

/**
 * Hook that loads the knowledge base.
 * In local mode: imports pre-built manifest (zero API calls).
 * In remote mode: fetches from GitHub API via the provider pipeline.
 */
export function useKnowledgeBase(sourceOverride?: SourceConfig): LoadingState {
  const [state, setState] = useState<LoadingState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState({ status: 'loading' });
      try {
        const local = await detectLocalMode();

        if (local) {
          const { graph, config } = await loadLocalKnowledgeBase();
          if (!cancelled) {
            if (graph.nodes.length === 0) {
              setState({
                status: 'error',
                error: 'No content found in local manifest. Run `npm run prebuild` to regenerate.',
              });
            } else {
              const finalGraph = isDemoEntitiesEnabled() ? injectDemoEntities(graph) : graph;
              exposeAuditGraph(finalGraph, config, 'local');
              setState({ status: 'ready', graph: finalGraph, config });
            }
          }
          return;
        }

        // Remote mode — fetch from GitHub API via the provider pipeline
        const { graph, config } = await loadRemoteKnowledgeBase(sourceOverride, 'standard');
        if (!cancelled) {
          if (graph.nodes.length === 0) {
            setState({
              status: 'error',
              error: 'No content loaded. The GitHub API may be rate-limited — try again in a minute, or check your network.',
            });
          } else {
            const finalGraph = isDemoEntitiesEnabled() ? injectDemoEntities(graph) : graph;
            exposeAuditGraph(finalGraph, config, 'remote');
            setState({ status: 'ready', graph: finalGraph, config });
          }
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            status: 'error',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [sourceOverride]);

  return state;
}

/**
 * Expose the resolved full graph + config on `window.__kbeGraph` so the
 * visual audit can probe the unfiltered topology. The HUD-mounted vis
 * networks only render a 40-node filtered view, so without this hook the
 * audit cannot tell whether disconnections happen in the data or only in
 * the visible subset. Storing references (not clones) — the audit is
 * read-only and the page is throwaway, so no mutation risk.
 */
function exposeAuditGraph(graph: KBGraph, config: KBConfig, mode: 'local' | 'remote'): void {
  if (typeof window === 'undefined') return;
  try {
    (window as unknown as { __kbeGraph?: unknown }).__kbeGraph = {
      mode,
      graph,
      config,
      stats: {
        nodes: graph.nodes.length,
        edges: graph.edges.length,
        clusters: graph.clusters.length,
      },
    };
  } catch {
    /* ignore — non-fatal */
  }
}
