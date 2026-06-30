/**
 * Shared color parsing / normalization for the theme adapters.
 *
 * Centralizes the hex + `rgb()` parsing introduced for the constellation edge
 * colors (#402's `withAlpha`) and extends it to the color syntaxes a canvas host
 * actually mirrors — short hex (`#fff`) and comma- OR space-separated `rgb()` —
 * so host-theme adoption (#404) makes correct luminance/base-mode, brand-ramp,
 * and neutral-token decisions instead of silently falling back to a dark base or
 * dropping an `rgb()` accent. One canonical parser, no per-call-site duplication.
 */

/** Parsed RGB channels (0–255). */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * Parse a CSS color into RGB channels. Handles `#rgb`, `#rrggbb`, and
 * `rgb()/rgba()` with comma- or space-separated channels. Returns `null` for
 * any syntax it doesn't recognize (named colors, hsl(), etc.) so callers can
 * fall back gracefully rather than mis-deriving a value.
 */
export function parseColor(color: string): Rgb | null {
  const c = color.trim();

  const short = /^#([0-9a-fA-F]{3})$/.exec(c);
  if (short) {
    const h = short[1];
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }

  const full = /^#([0-9a-fA-F]{6})$/.exec(c);
  if (full) {
    const n = parseInt(full[1], 16);
    return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
  }

  const rgb = /^rgba?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})/.exec(c);
  if (rgb) {
    return { r: +rgb[1], g: +rgb[2], b: +rgb[3] };
  }

  return null;
}

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const toHex2 = (n: number) => clamp(n).toString(16).padStart(2, '0');

/** Normalize a recognized color to canonical `#rrggbb`; `null` if unparseable. */
export function normalizeColorToHex(color: string): string | null {
  const c = parseColor(color);
  return c ? `#${toHex2(c.r)}${toHex2(c.g)}${toHex2(c.b)}` : null;
}

/**
 * Perceived-luminance dark test (`< 0.5`). Returns `null` when the color can't
 * be parsed so callers can choose their own default rather than guessing.
 */
export function colorIsDark(color: string): boolean | null {
  const c = parseColor(color);
  if (!c) return null;
  return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255 < 0.5;
}
