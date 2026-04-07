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

        // Load content based on mode
        const nodes = config.source.path
          ? await loadAuthoredContent(source, config.source.path)
          : await loadRepoContent(source);

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
