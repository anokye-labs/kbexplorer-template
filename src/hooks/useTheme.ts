import { useState, useEffect, useCallback } from 'react';
import type { Theme } from '../types';

const STORAGE_KEY = 'kbe-theme';
const THEMES: Theme[] = ['dark', 'light', 'sepia'];
const CLASS_MAP: Record<Theme, string> = {
  dark: '',
  light: 'theme-light',
  sepia: 'theme-sepia',
};

function readStored(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && THEMES.includes(v as Theme)) return v as Theme;
  } catch { /* ignore */ }
  return 'dark';
}

function applyBodyClass(theme: Theme) {
  document.body.classList.remove('theme-light', 'theme-sepia');
  const cls = CLASS_MAP[theme];
  if (cls) document.body.classList.add(cls);
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(readStored);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
    applyBodyClass(t);
  }, []);

  // Apply on mount
  useEffect(() => {
    applyBodyClass(theme);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return [theme, setTheme];
}

/** Cycle to the next theme in order. */
export function nextTheme(current: Theme): Theme {
  const i = THEMES.indexOf(current);
  return THEMES[(i + 1) % THEMES.length];
}
