/**
 * Command palette for kbexplorer search.
 *
 * Opened by:
 *   - Ctrl-K or '/' (global keyboard shortcut — wired in useKeyboardNav)
 *   - The HUD search button
 *
 * Shows instant text-search results from the inverted index, with optional
 * semantic search results from the kbexplorer-search HTTP service when
 * VITE_SEARCH_SERVICE_URL is configured.
 *
 * A11y: combobox role on the input, listbox role on the results list with
 * option roles on the interactive result buttons. Arrow keys move the active
 * option; Enter navigates; Esc (or backdrop click) closes. Focus stays on the
 * input; there is deliberately no Tab trap — the dialog is dismissed rather
 * than cycled.
 */
import React, { useEffect, useRef, useState, useCallback, useId } from 'react';
import {
  makeStyles,
  tokens,
  Badge,
  Spinner,
} from '@fluentui/react-components';
import { SearchRegular, DismissRegular, SparkleRegular, LinkRegular } from '@fluentui/react-icons';
import type { SearchIndex, SearchResult } from '../search/index';
import { searchIndex } from '../search/index';
import { useSemanticSearch } from '../search/useSemanticSearch';
import type { SemanticResult } from '../search/useSemanticSearch';

const useStyles = makeStyles({
  overlay: {
    position: 'fixed',
    inset: '0',
    zIndex: 500,
    backgroundColor: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '12vh',
  },
  dialog: {
    width: 'min(640px, 90vw)',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusXLarge,
    boxShadow: tokens.shadow64,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '70vh',
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  inputEl: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: tokens.fontSizeBase400,
    color: tokens.colorNeutralForeground1,
    '::placeholder': {
      color: tokens.colorNeutralForeground3,
    },
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '2px',
    color: tokens.colorNeutralForeground3,
    display: 'flex',
    alignItems: 'center',
    borderRadius: tokens.borderRadiusSmall,
    ':hover': {
      color: tokens.colorNeutralForeground1,
    },
  },
  list: {
    overflowY: 'auto',
    padding: `${tokens.spacingVerticalXS} 0`,
    flex: 1,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    width: '100%',
    textAlign: 'left',
    color: tokens.colorNeutralForeground1,
    borderRadius: '0',
  },
  itemActive: {
    backgroundColor: tokens.colorNeutralBackground3,
  },
  itemTitle: {
    flex: 1,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemSub: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '120px',
  },
  itemSnippet: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    width: '100%',
    paddingLeft: tokens.spacingHorizontalM,
    paddingBottom: tokens.spacingVerticalXS,
  },
  empty: {
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalM}`,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase300,
    textAlign: 'center',
  },
  hint: {
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    color: tokens.colorNeutralForeground4,
    fontSize: tokens.fontSizeBase200,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    display: 'flex',
    gap: tokens.spacingHorizontalM,
  },
  kbd: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase100,
    padding: '1px 5px',
    borderRadius: tokens.borderRadiusSmall,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    marginTop: tokens.spacingVerticalXS,
  },
  suggestionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    width: '100%',
    textAlign: 'left',
    color: tokens.colorNeutralForeground3,
    borderRadius: '0',
    fontSize: tokens.fontSizeBase200,
  },
  scoreBar: {
    width: '3rem',
    height: '4px',
    borderRadius: '2px',
    backgroundColor: tokens.colorNeutralBackground4,
    overflow: 'hidden',
    flexShrink: 0,
  },
  scoreFill: {
    height: '100%',
    borderRadius: '2px',
    backgroundColor: tokens.colorBrandBackground,
  },
});

function matchFieldLabel(field: SearchResult['matchField']): string {
  if (field === 'heading') return 'heading';
  if (field === 'body') return 'body';
  return 'title';
}

/** Unified item for keyboard nav across text, semantic, and suggestion sections. */
interface NavigableItem {
  nodeId: string;
  kind: 'text' | 'semantic' | 'suggestion';
}

interface SearchPaletteProps {
  index: SearchIndex;
  onClose: () => void;
  onNavigate: (nodeId: string) => void;
}

export function SearchPalette({ index, onClose, onNavigate }: SearchPaletteProps) {
  const styles = useStyles();
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();
  const inputId = useId();

  const semantic = useSemanticSearch();

  // Text search results (instant)
  const textResults = React.useMemo(
    () => (query.trim().length >= 1 ? searchIndex(index, query, 20) : []),
    [index, query],
  );

  // Trigger semantic search on query change
  useEffect(() => {
    if (semantic.enabled) {
      semantic.search(query);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, semantic.enabled]);

  // Clean up semantic search on unmount
  useEffect(() => {
    return () => { semantic.clear(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deduplicate semantic results — exclude nodeIds already in text results
  const textNodeIds = React.useMemo(
    () => new Set(textResults.map(r => r.nodeId)),
    [textResults],
  );

  const semanticOnly = React.useMemo(
    () => semantic.state.results.filter(r => !textNodeIds.has(r.nodeId)),
    [semantic.state.results, textNodeIds],
  );

  const allNodeIds = React.useMemo(() => {
    const ids = new Set(textNodeIds);
    for (const r of semanticOnly) ids.add(r.nodeId);
    return ids;
  }, [textNodeIds, semanticOnly]);

  const filteredSuggestions = React.useMemo(
    () => semantic.state.suggestions.filter(s => !allNodeIds.has(s.nodeId)),
    [semantic.state.suggestions, allNodeIds],
  );

  // Build flat navigable list for keyboard nav
  const navItems = React.useMemo<NavigableItem[]>(() => {
    const items: NavigableItem[] = [];
    for (const r of textResults) items.push({ nodeId: r.nodeId, kind: 'text' });
    for (const r of semanticOnly) items.push({ nodeId: r.nodeId, kind: 'semantic' });
    for (const s of filteredSuggestions) items.push({ nodeId: s.nodeId, kind: 'suggestion' });
    return items;
  }, [textResults, semanticOnly, filteredSuggestions]);

  // Reset active index when results change
  useEffect(() => { setActiveIdx(0); }, [query]);

  // Focus input on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, []);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector('[aria-selected="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const navigate = useCallback((nodeId: string) => {
    onNavigate(nodeId);
    onClose();
  }, [onNavigate, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIdx(i => (navItems.length === 0 ? 0 : Math.min(i + 1, navItems.length - 1)));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIdx(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (navItems[activeIdx]) navigate(navItems[activeIdx].nodeId);
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [navItems, activeIdx, navigate, onClose]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const handleDialogKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [onClose]);

  // Track global nav index across sections
  let globalIdx = 0;

  return (
    /* eslint-disable jsx-a11y/no-static-element-interactions */
    <div
      className={styles.overlay}
      onClick={handleOverlayClick}
      role="presentation"
      data-testid="search-overlay"
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Search nodes"
        onKeyDown={handleDialogKeyDown}
        data-testid="search-dialog"
      >
        {/* Input row */}
        <div className={styles.inputRow}>
          <SearchRegular style={{ fontSize: 20, color: tokens.colorNeutralForeground3, flexShrink: 0 }} />
          <input
            ref={inputRef}
            id={inputId}
            className={styles.inputEl}
            type="text"
            role="combobox"
            aria-expanded={query.trim().length >= 1}
            aria-controls={listboxId}
            aria-activedescendant={navItems[activeIdx] ? `search-result-${activeIdx}` : undefined}
            aria-label="Search knowledge base"
            placeholder={semantic.enabled ? 'Search nodes… (text + semantic)' : 'Search nodes… (type to start)'}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
            data-testid="search-input"
          />
          {semantic.state.loading && (
            <Spinner size="tiny" style={{ flexShrink: 0 }} />
          )}
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close search"
            tabIndex={0}
          >
            <DismissRegular style={{ fontSize: 16 }} />
          </button>
        </div>

        {/* Results */}
        <ul
          ref={listRef}
          id={listboxId}
          className={styles.list}
          role="listbox"
          aria-label="Search results"
          data-testid="search-results"
        >
          {/* Text search results */}
          {textResults.length > 0 && textResults.map((r) => {
            const idx = globalIdx++;
            return (
              <li key={`text-${r.nodeId}`} role="presentation">
                <button
                  id={`search-result-${idx}`}
                  role="option"
                  aria-selected={idx === activeIdx}
                  data-testid={`search-result-${idx}`}
                  className={`${styles.item}${idx === activeIdx ? ' ' + styles.itemActive : ''}`}
                  style={idx === activeIdx ? { backgroundColor: tokens.colorNeutralBackground3 } : undefined}
                  onClick={() => navigate(r.nodeId)}
                  onMouseEnter={() => setActiveIdx(idx)}
                  tabIndex={-1}
                >
                  <span className={styles.itemTitle}>{r.title}</span>
                  <span className={styles.itemSub}>{r.cluster}</span>
                  {r.matchField !== 'title' && (
                    <Badge appearance="outline" size="small" style={{ flexShrink: 0 }}>
                      {matchFieldLabel(r.matchField)}
                    </Badge>
                  )}
                  <Badge appearance="tint" size="small" style={{ flexShrink: 0 }}>
                    {r.entityType ?? r.type}
                  </Badge>
                </button>
              </li>
            );
          })}

          {/* Semantic search results (deduplicated) */}
          {semanticOnly.length > 0 && (
            <li role="presentation">
              <div className={styles.sectionHeader}>
                <SparkleRegular style={{ fontSize: 12 }} />
                <span>Semantic matches</span>
              </div>
            </li>
          )}
          {semanticOnly.map((r) => {
            const idx = globalIdx++;
            return (
              <SemanticResultItem
                key={`sem-${r.nodeId}`}
                result={r}
                idx={idx}
                activeIdx={activeIdx}
                styles={styles}
                onNavigate={navigate}
                onHover={setActiveIdx}
              />
            );
          })}

          {/* Related suggestions */}
          {filteredSuggestions.length > 0 && (
            <li role="presentation">
              <div className={styles.sectionHeader}>
                <LinkRegular style={{ fontSize: 12 }} />
                <span>Related nodes</span>
              </div>
            </li>
          )}
          {filteredSuggestions.map((s) => {
            const idx = globalIdx++;
            return (
              <li key={`sug-${s.nodeId}`} role="presentation">
                <button
                  id={`search-result-${idx}`}
                  role="option"
                  aria-selected={idx === activeIdx}
                  className={`${styles.suggestionItem}${idx === activeIdx ? ' ' + styles.itemActive : ''}`}
                  style={idx === activeIdx ? { backgroundColor: tokens.colorNeutralBackground3 } : undefined}
                  onClick={() => navigate(s.nodeId)}
                  onMouseEnter={() => setActiveIdx(idx)}
                  tabIndex={-1}
                >
                  <span className={styles.itemTitle} style={{ fontWeight: tokens.fontWeightRegular }}>
                    {s.title}
                  </span>
                  <span className={styles.itemSub}>{s.cluster}</span>
                  <Badge appearance="outline" size="small" style={{ flexShrink: 0, opacity: 0.7 }}>
                    {s.reason}
                  </Badge>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Empty state */}
        {navItems.length === 0 && query.trim().length >= 1 && !semantic.state.loading && (
          <div className={styles.empty} role="status">No results for &ldquo;{query}&rdquo;</div>
        )}

        {/* Error state */}
        {semantic.state.error && (
          <div className={styles.empty} role="alert" style={{ color: tokens.colorPaletteRedForeground1 }}>
            Semantic search: {semantic.state.error}
          </div>
        )}

        {/* Hint bar */}
        <div className={styles.hint} aria-hidden="true">
          <span><kbd className={styles.kbd}>↑↓</kbd> navigate</span>
          <span><kbd className={styles.kbd}>↵</kbd> open</span>
          <span><kbd className={styles.kbd}>Esc</kbd> close</span>
          {semantic.enabled && <span style={{ marginLeft: 'auto', opacity: 0.6 }}>semantic search active</span>}
        </div>
      </div>
    </div>
  );
}

function SemanticResultItem({
  result,
  idx,
  activeIdx,
  styles,
  onNavigate,
  onHover,
}: {
  result: SemanticResult;
  idx: number;
  activeIdx: number;
  styles: ReturnType<typeof useStyles>;
  onNavigate: (nodeId: string) => void;
  onHover: (idx: number) => void;
}) {
  const isActive = idx === activeIdx;
  return (
    <li role="presentation">
      <button
        id={`search-result-${idx}`}
        role="option"
        aria-selected={isActive}
        className={`${styles.item}${isActive ? ' ' + styles.itemActive : ''}`}
        style={isActive ? { backgroundColor: tokens.colorNeutralBackground3 } : undefined}
        onClick={() => onNavigate(result.nodeId)}
        onMouseEnter={() => onHover(idx)}
        tabIndex={-1}
      >
        <span className={styles.itemTitle}>{result.title}</span>
        <span className={styles.itemSub}>{result.cluster}</span>
        <div className={styles.scoreBar}>
          <div
            className={styles.scoreFill}
            style={{ width: `${Math.round(result.score * 100)}%` }}
          />
        </div>
        {result.entityType && (
          <Badge appearance="tint" size="small" style={{ flexShrink: 0 }}>
            {result.entityType}
          </Badge>
        )}
      </button>
      {result.snippet && (
        <div className={styles.itemSnippet}>{result.snippet}</div>
      )}
    </li>
  );
}
