/**
 * Hook: memoize the search index from the loaded graph nodes.
 * Re-builds only when node count or node IDs change.
 */
import { useMemo, useRef } from 'react';
import type { KBNode } from '../types';
import { buildSearchIndex, searchIndex as _searchIndex } from './index';
import type { SearchIndex, SearchResult } from './index';

export type { SearchIndex, SearchResult };
export { buildSearchIndex, _searchIndex as searchIndex };

export function useSearchIndex(nodes: KBNode[]): SearchIndex {
  // Stable key: a fingerprint of node IDs so we don't re-index on unrelated re-renders.
  const keyRef = useRef<string>('');
  const key = nodes.map(n => n.id).join('\x00');

  return useMemo(() => {
    keyRef.current = key;
    return buildSearchIndex(nodes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
