import { useState, useEffect } from 'react';
import type { KBGraph, KBConfig, SourceConfig } from '../types';
import { DEFAULT_CONFIG } from '../types';
import {
  loadConfig,
  loadRepoContent,
  loadAuthoredContent,
  extractClusters,
  buildGraph,
} from '../engine';

export type LoadingState =
  | { status: 'loading' }
  | { status: 'ready'; graph: KBGraph; config: KBConfig }
  | { status: 'error'; error: string };

/**
 * Hook that loads the knowledge base from GitHub at runtime.
 * Fetches config, content (repo-aware or authored), computes graph.
 */
export function useKnowledgeBase(sourceOverride?: SourceConfig): LoadingState {
  const [state, setState] = useState<LoadingState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState({ status: 'loading' });
      try {
        const source = sourceOverride ?? DEFAULT_CONFIG.source;
        const config = await loadConfig(source);

        // Load content — blend both modes when authored content exists alongside repo
        let nodes = await loadRepoContent(source);

        // If there's a content path, also load authored content and merge
        if (config.source.path) {
          try {
            const authored = await loadAuthoredContent(source, config.source.path);
            nodes = [...nodes, ...authored];
          } catch {
            // Authored content dir may not exist — that's fine, repo-aware still works
          }
        }

        const clusters = extractClusters(nodes, config);
        const graph = buildGraph(nodes, clusters);

        if (!cancelled) {
          if (nodes.length === 0) {
            setState({
              status: 'error',
              error: 'No content loaded. The GitHub API may be rate-limited — try again in a minute, or check your network.',
            });
          } else {
            setState({ status: 'ready', graph, config });
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
