import { useState, useCallback } from 'react';
import {
  webDarkTheme,
  webLightTheme,
  type Theme as FluentTheme,
} from '@fluentui/react-components';

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'kbe-theme';

function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch { /* ignore */ }
  return 'dark';
}

const THEME_MAP: Record<ThemeMode, FluentTheme> = {
  dark: webDarkTheme,
  light: webLightTheme,
};

export function useTheme(): [ThemeMode, FluentTheme, (t: ThemeMode) => void] {
  const [mode, setModeState] = useState<ThemeMode>(readStored);

  const setMode = useCallback((t: ThemeMode) => {
    setModeState(t);
    localStorage.setItem(STORAGE_KEY, t);
  }, []);

  return [mode, THEME_MAP[mode], setMode];
}

export function nextTheme(current: ThemeMode): ThemeMode {
  return current === 'dark' ? 'light' : 'dark';
}
