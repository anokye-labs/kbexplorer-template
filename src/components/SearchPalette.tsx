/**
 * Command palette for kbexplorer search.
 *
 * Opened by:
 *   - Ctrl-K or '/' (global keyboard shortcut — wired in useKeyboardNav)
 *   - The HUD search button
 *
 * A11y: combobox role on the input, listbox + option roles on results.
 * Arrow keys move focus within the listbox; Enter navigates; Esc closes.
 * Focus is trapped inside the dialog while open.
 */
import React, { useEffect, useRef, useState, useCallback, useId } from 'react';
import {
  makeStyles,
  tokens,
  Badge,
} from '@fluentui/react-components';
import { SearchRegular, DismissRegular } from '@fluentui/react-icons';
import type { SearchIndex, SearchResult } from '../search/index';
import { searchIndex } from '../search/index';

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
});

function matchFieldLabel(field: SearchResult['matchField']): string {
  if (field === 'heading') return 'heading';
  if (field === 'body') return 'body';
  return 'title';
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

  const results = query.trim().length >= 1
    ? searchIndex(index, query, 20)
    : [];

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
        setActiveIdx(i => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIdx(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[activeIdx]) navigate(results[activeIdx].nodeId);
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [results, activeIdx, navigate, onClose]);

  // Close on overlay click
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  // Trap focus inside dialog
  const handleDialogKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      // Let Tab move naturally within the dialog; Esc closes
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [onClose]);

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
            aria-expanded={results.length > 0}
            aria-controls={listboxId}
            aria-activedescendant={results[activeIdx] ? `search-result-${activeIdx}` : undefined}
            aria-label="Search knowledge base"
            placeholder="Search nodes… (type to start)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
            data-testid="search-input"
          />
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
          {results.length > 0 ? (
            results.map((r, i) => (
              <li
                key={r.nodeId}
                id={`search-result-${i}`}
                role="option"
                aria-selected={i === activeIdx}
                data-testid={`search-result-${i}`}
              >
                <button
                  className={`${styles.item}${i === activeIdx ? ' ' + styles.itemActive : ''}`}
                  style={i === activeIdx ? { backgroundColor: tokens.colorNeutralBackground3 } : undefined}
                  onClick={() => navigate(r.nodeId)}
                  onMouseEnter={() => setActiveIdx(i)}
                  tabIndex={-1}
                >
                  <span className={styles.itemTitle}>{r.title}</span>
                  <span className={styles.itemSub}>{r.cluster}</span>
                  {r.matchField !== 'title' && (
                    <Badge
                      appearance="outline"
                      size="small"
                      style={{ flexShrink: 0 }}
                    >
                      {matchFieldLabel(r.matchField)}
                    </Badge>
                  )}
                  <Badge
                    appearance="tint"
                    size="small"
                    style={{ flexShrink: 0 }}
                  >
                    {r.entityType ?? r.type}
                  </Badge>
                </button>
              </li>
            ))
          ) : query.trim().length >= 1 ? (
            <li role="option" aria-selected={false}>
              <div className={styles.empty}>No results for &ldquo;{query}&rdquo;</div>
            </li>
          ) : null}
        </ul>

        {/* Hint bar */}
        <div className={styles.hint} aria-hidden="true">
          <span><kbd className={styles.kbd}>↑↓</kbd> navigate</span>
          <span><kbd className={styles.kbd}>↵</kbd> open</span>
          <span><kbd className={styles.kbd}>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
