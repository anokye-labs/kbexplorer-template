import { useState, useEffect } from 'react';
import type { KBGraph, KBConfig, SourceConfig } from '../types';
import { detectLocalMode, loadLocalKnowledgeBase } from '../engine/local-loader';
import { loadRemoteKnowledgeBase } from '../engine/remote-loader';

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
              setState({ status: 'ready', graph, config });
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
