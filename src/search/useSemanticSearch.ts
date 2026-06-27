/**
 * Hook for semantic search via the kbexplorer-search HTTP service.
 *
 * Calls POST /search on the configured service URL. Inactive when
 * VITE_SEARCH_SERVICE_URL is not set — the text-based search index
 * remains the zero-config default.
 */
import { useState, useCallback, useRef, useEffect } from 'react';

export interface SemanticResult {
  nodeId: string;
  title: string;
  cluster: string;
  score: number;
  snippet: string;
  chunkIndex: number;
  path?: string;
  parentId?: string;
  entityType?: string;
  connections: string[];
}

export interface SemanticSuggestion {
  nodeId: string;
  title: string;
  cluster: string;
  reason: 'neighbor' | 'parent' | 'child' | 'shared-cluster';
  sourceNodeIds: string[];
}

export interface SemanticSearchState {
  results: SemanticResult[];
  suggestions: SemanticSuggestion[];
  loading: boolean;
  error: string | null;
}

const INITIAL: SemanticSearchState = {
  results: [],
  suggestions: [],
  loading: false,
  error: null,
};

function getServiceUrl(): string | null {
  const url = import.meta.env.VITE_SEARCH_SERVICE_URL;
  return url && url.trim() !== '' ? url.replace(/\/+$/, '') : null;
}

export function useSemanticSearch(): {
  enabled: boolean;
  state: SemanticSearchState;
  search: (query: string) => void;
  clear: () => void;
} {
  const serviceUrl = getServiceUrl();
  const enabled = serviceUrl !== null;
  const [state, setState] = useState<SemanticSearchState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setState(INITIAL);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const search = useCallback((query: string) => {
    if (!serviceUrl) return;
    if (query.trim().length < 2) {
      clear();
      return;
    }

    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Debounce 300ms to avoid flooding the service during typing
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        const res = await fetch(`${serviceUrl}/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: query.trim(),
            limit: 10,
            graphRanking: true,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Search service returned ${res.status}`);
        }

        const data = await res.json();

        if (!controller.signal.aborted) {
          setState({
            results: data.results ?? [],
            suggestions: data.suggestions ?? [],
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!controller.signal.aborted) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err.message : 'Search failed',
          }));
        }
      }
    }, 300);
  }, [serviceUrl, clear]);

  return { enabled, state, search, clear };
}
