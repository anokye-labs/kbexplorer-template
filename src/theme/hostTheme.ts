/**
 * Host CSS-var → Fluent `Theme` adapter (#404, epic #401).
 *
 * A GitHub Copilot canvas (or any embedding host) mirrors a small set of
 * **semantic** CSS variables into the embedded surface's `:root` —
 * `--background-color-default`, `--text-color-*`, `--font-sans` / `--font-mono`,
 * and a true-color accent. The SPA otherwise themes only from Fluent token names
 * (`themeModule`, external YAML, `clusterTokens`). This adapter reads those host
 * vars and produces a Fluent `Theme` so the SPA inherits the host's look with no
 * fork — the missing seam called out in #401/#404.
 *
 * It also consumes the host-neutral presentation-token contract published in
 * `@anokye-labs/kbexplorer-core` (`PresentationTokens`, core#15): the *intent*
 * knobs (typography size/line-height, corner-radius) are folded into the same
 * resolved theme. Color/font come from the host's concrete (true-color) vars;
 * the intent tokens carry portable design choices the host expresses abstractly.
 *
 * Pure and side-effect free: the signal-reading and theme-building steps take an
 * injectable reader so they are unit-testable without a DOM, and degrade to
 * `null` (no host theme) when the host mirrors nothing.
 */
import {
  webDarkTheme,
  webLightTheme,
  createDarkTheme,
  createLightTheme,
  type Theme as FluentTheme,
} from '@fluentui/react-components';
import type { PresentationTokens } from '@anokye-labs/kbexplorer-core';
import { generateBrandVariants } from './brandRamp';

/** Reads a single CSS custom property by name (with leading `--`); '' if unset. */
export type CssVarReader = (name: string) => string;

/**
 * Semantic host variables, each as a priority-ordered candidate list (first
 * non-empty wins). The primary names follow #404's contract; the trailing
 * aliases accept common host conventions (GitHub Primer / Copilot) so the
 * adapter is resilient to the exact var names a host chooses to mirror.
 */
export const HOST_VAR_CANDIDATES = {
  background:      ['--background-color-default', '--bgColor-default', '--color-canvas-default'],
  backgroundMuted: ['--background-color-muted', '--background-color-secondary', '--bgColor-muted', '--color-canvas-subtle'],
  foreground:      ['--text-color-default', '--text-color-primary', '--fgColor-default', '--color-fg-default'],
  foregroundMuted: ['--text-color-muted', '--text-color-secondary', '--fgColor-muted', '--color-fg-muted'],
  accent:          ['--text-color-link', '--accent-color', '--fgColor-accent', '--color-accent-fg'],
  fontSans:        ['--font-sans', '--fontStack-sans', '--font-family-sans'],
  fontMono:        ['--font-mono', '--fontStack-monospace', '--font-family-mono'],
} as const;

/** Resolved semantic signals mirrored by the host (any subset may be present). */
export interface HostThemeSignals {
  background?: string;
  backgroundMuted?: string;
  foreground?: string;
  foregroundMuted?: string;
  accent?: string;
  fontSans?: string;
  fontMono?: string;
}

function firstVar(read: CssVarReader, names: readonly string[]): string {
  for (const n of names) {
    const v = read(n).trim();
    if (v) return v;
  }
  return '';
}

/** Read every known host signal via `read`, omitting unset ones. */
export function readHostSignals(read: CssVarReader): HostThemeSignals {
  const out: HostThemeSignals = {};
  for (const key of Object.keys(HOST_VAR_CANDIDATES) as (keyof typeof HOST_VAR_CANDIDATES)[]) {
    const v = firstVar(read, HOST_VAR_CANDIDATES[key]);
    if (v) out[key] = v;
  }
  return out;
}

/**
 * Whether the host mirrored enough to theme from — at least one of a
 * background or foreground color. Font-only or accent-only signals are treated
 * as "no host theme" so we never override neutrals with nothing meaningful.
 */
export function hasHostTheme(signals: HostThemeSignals): boolean {
  return Boolean(signals.background || signals.foreground);
}

/** Perceived-luminance dark test for a hex or `rgb()/rgba()` color; null if unparseable. */
function isDarkColor(color: string): boolean | null {
  const hex = /^#?([0-9a-fA-F]{6})$/.exec(color.trim());
  if (hex) {
    const n = parseInt(hex[1], 16);
    const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
  }
  const rgb = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(color);
  if (rgb) {
    const r = +rgb[1], g = +rgb[2], b = +rgb[3];
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
  }
  return null;
}

/** Named corner-radius steps → px (mirrors core's `CornerRadiusStep`). */
const CORNER_STEP_PX: Record<string, number> = {
  none: 0,
  small: 2,
  medium: 4,
  large: 8,
  pill: 9999,
};

/**
 * Build a Fluent `Theme` from resolved host signals plus optional host-neutral
 * presentation tokens. Pure: no DOM access. The base mode (dark/light) is chosen
 * from the host background's luminance; a host accent (true-color) reseeds the
 * Fluent brand ramp; neutral background/foreground tokens adopt the host colors;
 * fonts adopt the host's `--font-sans`/`--font-mono`. PresentationTokens fold in
 * the intent knobs (typography size/line-height, corner radius).
 */
export function hostSignalsToFluentTheme(
  signals: HostThemeSignals,
  presentation?: PresentationTokens,
): FluentTheme {
  const dark = signals.background ? (isDarkColor(signals.background) ?? true) : true;
  let base: FluentTheme = dark ? webDarkTheme : webLightTheme;

  if (signals.accent) {
    try {
      const variants = generateBrandVariants(signals.accent);
      base = (dark ? createDarkTheme : createLightTheme)(variants);
    } catch {
      /* unparseable accent → keep the neutral base */
    }
  }

  const overrides: Record<string, string> = {};

  if (signals.background) {
    overrides.colorNeutralBackground1 = signals.background;
    overrides.colorNeutralBackground2 = signals.backgroundMuted ?? signals.background;
    overrides.colorNeutralBackground3 = signals.backgroundMuted ?? signals.background;
    overrides.colorNeutralCardBackground = signals.backgroundMuted ?? signals.background;
  }
  if (signals.foreground) {
    overrides.colorNeutralForeground1 = signals.foreground;
    overrides.colorNeutralForeground2 = signals.foregroundMuted ?? signals.foreground;
    overrides.colorNeutralForeground3 = signals.foregroundMuted ?? signals.foreground;
  }
  if (signals.fontSans) overrides.fontFamilyBase = signals.fontSans;
  if (signals.fontMono) overrides.fontFamilyMonospace = signals.fontMono;

  // PresentationTokens (host-neutral intent) — typography + corner radius.
  const typ = presentation?.typography;
  if (typ?.baseSizePx) overrides.fontSizeBase300 = `${typ.baseSizePx}px`;
  if (typ?.lineHeight) overrides.lineHeightBase300 = String(typ.lineHeight);

  const cr = presentation?.cornerRadius;
  const crPx = cr?.valuePx ?? (cr?.step ? CORNER_STEP_PX[cr.step] : undefined);
  if (crPx !== undefined) {
    overrides.borderRadiusMedium = `${crPx}px`;
    overrides.borderRadiusLarge = `${crPx}px`;
    overrides.borderRadiusSmall = `${Math.max(0, crPx - 2)}px`;
  }

  return { ...base, ...overrides } as FluentTheme;
}

/**
 * Resolve a Fluent `Theme` from the host vars mirrored onto `root` (default
 * `document.documentElement`). Returns `null` when there is no DOM (SSR/tests)
 * or the host mirrored no usable color signal — so callers can cleanly treat
 * "no host" as "use the built-in/config themes".
 */
export function resolveHostFluentTheme(
  root?: Element | null,
  presentation?: PresentationTokens,
): FluentTheme | null {
  const el = root ?? (typeof document !== 'undefined' ? document.documentElement : null);
  if (!el || typeof getComputedStyle === 'undefined') return null;
  let cs: CSSStyleDeclaration;
  try {
    cs = getComputedStyle(el);
  } catch {
    return null;
  }
  const signals = readHostSignals(name => {
    try { return cs.getPropertyValue(name); } catch { return ''; }
  });
  if (!hasHostTheme(signals)) return null;
  return hostSignalsToFluentTheme(signals, presentation);
}
