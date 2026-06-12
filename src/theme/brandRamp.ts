import type { BrandVariants } from '@fluentui/react-components';

/**
 * The 16 Fluent brand ramp stop keys, in order (10 → 160).
 * Lower stops are darker (near-black); higher stops are lighter (near-white).
 */
const STOPS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160] as const;

// Lightness (in %) for the clamped ramp endpoints.
const NEAR_BLACK_L = 3;
const NEAR_WHITE_L = 97;

// The seed's lightness is anchored near the middle of the ramp. Clamping it
// into this range guarantees both halves of the ramp stay strictly monotonic.
const ANCHOR_INDEX = 7; // stop "80"
const ANCHOR_MIN_L = 12;
const ANCHOR_MAX_L = 88;

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Normalize a seed hex string into a 6-digit, lowercase, '#'-prefixed value.
 * Accepts 3- or 6-digit hex with or without a leading '#'. Throws on anything
 * that is not a valid hex color.
 */
function normalizeHex(input: string): string {
  if (typeof input !== 'string') {
    throw new TypeError(`Invalid seed color: expected a string, received ${typeof input}`);
  }
  const raw = input.trim().replace(/^#/, '').toLowerCase();
  if (!/^[0-9a-f]+$/.test(raw)) {
    throw new Error(`Invalid seed color: "${input}" is not a valid hex color`);
  }
  if (raw.length === 3) {
    const [r, g, b] = raw.split('');
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (raw.length === 6) {
    return `#${raw}`;
  }
  throw new Error(`Invalid seed color: "${input}" must be a 3- or 6-digit hex color`);
}

function hexToRgb(hex: string): Rgb {
  const value = hex.replace(/^#/, '');
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const toHex = (channel: number): string =>
    clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn:
        h = ((gn - bn) / delta) % 6;
        break;
      case gn:
        h = (bn - rn) / delta + 2;
        break;
      default:
        h = (rn - gn) / delta + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r: number;
  let g: number;
  let b: number;
  if (hp >= 0 && hp < 1) {
    [r, g, b] = [c, x, 0];
  } else if (hp < 2) {
    [r, g, b] = [x, c, 0];
  } else if (hp < 3) {
    [r, g, b] = [0, c, x];
  } else if (hp < 4) {
    [r, g, b] = [0, x, c];
  } else if (hp < 5) {
    [r, g, b] = [x, 0, c];
  } else {
    [r, g, b] = [c, 0, x];
  }
  const m = ln - c / 2;
  return {
    r: (r + m) * 255,
    g: (g + m) * 255,
    b: (b + m) * 255,
  };
}

/**
 * Convert a single seed hex color into a deterministic 16-stop Fluent
 * `BrandVariants` ramp (numeric keys 10..160), suitable for `createLightTheme`
 * / `createDarkTheme`.
 *
 * The ramp preserves the seed's hue and saturation while varying lightness
 * monotonically: stop 10 clamps toward near-black and stop 160 toward
 * near-white, with the seed mapped near the middle (stop 80). The same seed
 * always produces the same ramp.
 */
export function generateBrandVariants(seedHex: string): BrandVariants {
  const hex = normalizeHex(seedHex);
  const { h, s, l } = rgbToHsl(hexToRgb(hex));

  const anchorL = clamp(l, ANCHOR_MIN_L, ANCHOR_MAX_L);

  const ramp = {} as Record<(typeof STOPS)[number], string>;
  STOPS.forEach((stop, index) => {
    let lightness: number;
    if (index <= ANCHOR_INDEX) {
      const t = index / ANCHOR_INDEX;
      lightness = NEAR_BLACK_L + (anchorL - NEAR_BLACK_L) * t;
    } else {
      const t = (index - ANCHOR_INDEX) / (STOPS.length - 1 - ANCHOR_INDEX);
      lightness = anchorL + (NEAR_WHITE_L - anchorL) * t;
    }
    ramp[stop] = rgbToHex(hslToRgb({ h, s, l: lightness }));
  });

  return ramp as BrandVariants;
}
