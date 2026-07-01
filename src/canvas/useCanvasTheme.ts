/**
 * Canvas theme resolution (#406, epic #407 / #401).
 *
 * The embeddable surface does NOT use the full-page `useTheme` machinery (the
 * `t`-cycle, localStorage persistence, config-theme chooser). Inside a canvas
 * the HOST owns the look: when `visualMode === 'inherit-host'` the Fluent theme
 * is resolved straight from the semantic CSS vars the host mirrors onto the
 * iframe `:root`, via the shared `theme/hostTheme.ts` adapter (#404). A host
 * theme switch re-mirrors those vars, so this hook observes `<html>` and
 * re-resolves — no reload, no user control.
 *
 * When the host mirrors nothing usable (or `visualMode === 'config'`), it falls
 * back to the repo's own configured theme (`buildThemeMap` + `theme.default`),
 * then to `webDarkTheme`, so the surface is never unthemed/blank.
 */
import { useEffect, useMemo, useState } from 'react';
import { webDarkTheme, type Theme as FluentTheme } from '@fluentui/react-components';
import type { KBConfig, PresentationTokens } from '../types';
import { resolveHostFluentTheme } from '../theme/hostTheme';
import { buildThemeMap } from '../hooks/useTheme';
import type { CanvasVisualMode } from './bootConfig';

/**
 * Resolve the repo's own configured theme (the non-host fallback): the config
 * `theme.default` if it names a built-in/config theme, else `dark`, else the
 * first available — always a real Fluent theme (never unthemed).
 */
function resolveConfigTheme(config?: KBConfig): FluentTheme {
  const map = buildThemeMap(config?.theme);
  const preferred = config?.theme?.default;
  if (preferred && map[preferred]) return map[preferred];
  return map.dark ?? Object.values(map)[0] ?? webDarkTheme;
}

/**
 * Pure resolver: build the active Fluent theme for a visual mode. Exposed for
 * unit tests. In `inherit-host` mode a real host theme wins; otherwise (or when
 * the host mirrors nothing) the configured theme is used.
 */
export function resolveCanvasTheme(
  visualMode: CanvasVisualMode,
  config?: KBConfig,
  root?: Element | null,
): FluentTheme {
  if (visualMode === 'inherit-host') {
    const presentation = (config?.theme as { presentation?: PresentationTokens } | undefined)
      ?.presentation;
    const host = resolveHostFluentTheme(
      root ?? (typeof document !== 'undefined' ? document.documentElement : null),
      presentation,
    );
    if (host) return host;
  }
  return resolveConfigTheme(config);
}

/**
 * React hook: the active Fluent theme for the canvas surface, re-resolving when
 * the host re-mirrors its semantic vars (theme switch). Observes the `<html>`
 * `style`/`class` attributes — the surfaces a host toggles theme through — in
 * `inherit-host` mode only; `config` mode resolves once from the static config.
 */
export function useCanvasTheme(visualMode: CanvasVisualMode, config?: KBConfig): FluentTheme {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (visualMode !== 'inherit-host') return;
    if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
    const el = document.documentElement;
    const observer = new MutationObserver(() => setTick(t => t + 1));
    observer.observe(el, { attributes: true, attributeFilter: ['style', 'class'] });
    return () => observer.disconnect();
  }, [visualMode]);

  // `tick` intentionally re-runs resolution when the host mutates <html>.
  return useMemo(
    () => resolveCanvasTheme(visualMode, config),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visualMode, config, tick],
  );
}
