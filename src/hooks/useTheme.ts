import { useState, useCallback } from 'react';
import {
  webDarkTheme,
  webLightTheme,
  createLightTheme,
  type Theme as FluentTheme,
  type BrandVariants,
} from '@fluentui/react-components';

export type ThemeMode = 'dark' | 'light' | 'sepia';

const STORAGE_KEY = 'kbe-theme';
const MODES: ThemeMode[] = ['dark', 'light', 'sepia'];

// Warm amber brand ramp for the sepia reading theme
const sepiaBrand: BrandVariants = {
  10: '#1C1308',
  20: '#2E2010',
  30: '#422E16',
  40: '#553C1C',
  50: '#6A4B22',
  60: '#7F5B29',
  70: '#956C30',
  80: '#A87D3A',
  90: '#B88E4E',
  100: '#C79F63',
  110: '#D4B07A',
  120: '#E0C192',
  130: '#EAD1AB',
  140: '#F2E1C5',
  150: '#F8EFDF',
  160: '#FCF7F0',
};

const sepiaTheme: FluentTheme = {
  ...createLightTheme(sepiaBrand),
  // Warm paper-like backgrounds
  colorNeutralBackground1: '#F5ECD7',
  colorNeutralBackground2: '#EDE4CC',
  colorNeutralBackground3: '#E5DBC2',
  colorNeutralBackground4: '#DDD2B8',
  colorNeutralBackground5: '#D5C9AE',
  colorNeutralBackground6: '#CFC3A6',
  // Warm dark text for contrast
  colorNeutralForeground1: '#2A2520',
  colorNeutralForeground2: '#4A4238',
  colorNeutralForeground3: '#7A7068',
  colorNeutralForeground4: '#9A8E80',
  // Card backgrounds
  colorNeutralCardBackground: '#F8F0DC',
  colorNeutralCardBackgroundHover: '#FBF5E8',
  colorNeutralCardBackgroundPressed: '#F0E6CE',
  // Strokes
  colorNeutralStroke1: '#D0C4A8',
  colorNeutralStroke2: '#DDD2B8',
  colorNeutralStroke3: '#E8DEC8',
  // Subtle backgrounds
  colorSubtleBackground: 'transparent',
  colorSubtleBackgroundHover: '#EDE4CC',
  colorSubtleBackgroundPressed: '#E5DBC2',
};

function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && MODES.includes(v as ThemeMode)) return v as ThemeMode;
  } catch { /* ignore */ }
  return 'dark';
}

const THEME_MAP: Record<ThemeMode, FluentTheme> = {
  dark: webDarkTheme,
  light: webLightTheme,
  sepia: sepiaTheme,
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
  const i = MODES.indexOf(current);
  return MODES[(i + 1) % MODES.length];
}
