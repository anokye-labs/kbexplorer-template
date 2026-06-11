import { useEffect } from 'react';
import type { KBConfig } from '../types';

/** Minimal target that exposes a CSS-inline-style API (testable without a DOM). */
export type FontStyleTarget = {
  style: {
    setProperty(name: string, value: string): void;
    removeProperty(name: string): void;
  };
};

type FontConfig = NonNullable<KBConfig['theme']['font']>;

const FONT_VARS: Record<keyof FontConfig, string> = {
  heading: '--kbe-font-heading',
  body: '--kbe-font-body',
  mono: '--kbe-font-mono',
};

/**
 * Apply `config.theme.font.{heading,body,mono}` to CSS custom properties on the
 * given root element. When a font is omitted, the corresponding property is
 * removed so the CSS `var(..., <fallback>)` default takes effect.
 */
export function applyThemeFonts(
  font: KBConfig['theme']['font'] | undefined,
  root: FontStyleTarget = document.documentElement,
): void {
  (Object.keys(FONT_VARS) as (keyof FontConfig)[]).forEach(key => {
    const value = font?.[key];
    const cssVar = FONT_VARS[key];
    if (value) {
      root.style.setProperty(cssVar, value);
    } else {
      root.style.removeProperty(cssVar);
    }
  });
}

/** React hook that applies theme fonts to `document.documentElement` once config is available. */
export function useThemeFonts(font: KBConfig['theme']['font'] | undefined): void {
  useEffect(() => {
    applyThemeFonts(font);
  }, [font]);
}
