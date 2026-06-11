import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveInitialMode, readStoredRaw } from '../useTheme';

const STORAGE_KEY = 'kbe-theme';

function installLocalStorage() {
  const store = new Map<string, string>();
  const mock = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
  };
  (globalThis as { localStorage?: unknown }).localStorage = mock;
}

describe('useTheme initial mode resolution', () => {
  beforeEach(() => {
    installLocalStorage();
  });

  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('config.default applies when no stored theme', () => {
    expect(readStoredRaw()).toBeNull();
    expect(resolveInitialMode('light')).toBe('light');
  });

  it('stored theme wins over config.default', () => {
    localStorage.setItem(STORAGE_KEY, 'sepia');
    expect(resolveInitialMode('light')).toBe('sepia');
  });

  it('falls back to dark when no stored theme and no config default', () => {
    expect(resolveInitialMode(undefined)).toBe('dark');
  });

  it('ignores an invalid config default and falls back to dark', () => {
    expect(resolveInitialMode('chartreuse' as unknown as 'dark')).toBe('dark');
  });
});
