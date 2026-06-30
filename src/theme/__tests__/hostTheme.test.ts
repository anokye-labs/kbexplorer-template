import { describe, it, expect } from 'vitest';
import {
  readHostSignals,
  hasHostTheme,
  hostSignalsToFluentTheme,
  resolveHostFluentTheme,
  HOST_VAR_CANDIDATES,
  type CssVarReader,
} from '../hostTheme';

/** Build a CssVarReader from a plain { '--name': value } map. */
function reader(map: Record<string, string>): CssVarReader {
  return name => map[name] ?? '';
}

describe('readHostSignals / hasHostTheme', () => {
  it('reads each signal from its primary var name', () => {
    const s = readHostSignals(reader({
      '--background-color-default': '#0d1117',
      '--text-color-default': '#e6edf3',
      '--text-color-muted': '#8b949e',
      '--text-color-link': '#2f81f7',
      '--font-sans': 'Inter, sans-serif',
      '--font-mono': 'JetBrains Mono, monospace',
    }));
    expect(s).toEqual({
      background: '#0d1117',
      foreground: '#e6edf3',
      foregroundMuted: '#8b949e',
      accent: '#2f81f7',
      fontSans: 'Inter, sans-serif',
      fontMono: 'JetBrains Mono, monospace',
    });
    expect(hasHostTheme(s)).toBe(true);
  });

  it('falls back to alias var names when the primary is unset', () => {
    const s = readHostSignals(reader({
      '--bgColor-default': '#ffffff',
      '--fgColor-default': '#1f2328',
    }));
    expect(s.background).toBe('#ffffff');
    expect(s.foreground).toBe('#1f2328');
  });

  it('treats font-only / accent-only signals as no host theme', () => {
    expect(hasHostTheme(readHostSignals(reader({ '--font-sans': 'Inter' })))).toBe(false);
    expect(hasHostTheme(readHostSignals(reader({ '--text-color-link': '#2f81f7' })))).toBe(false);
    expect(hasHostTheme({})).toBe(false);
  });

  it('exposes the contract var names', () => {
    expect(HOST_VAR_CANDIDATES.background[0]).toBe('--background-color-default');
    expect(HOST_VAR_CANDIDATES.foreground[0]).toBe('--text-color-default');
    expect(HOST_VAR_CANDIDATES.fontSans[0]).toBe('--font-sans');
    expect(HOST_VAR_CANDIDATES.fontMono[0]).toBe('--font-mono');
  });
});

describe('hostSignalsToFluentTheme', () => {
  it('maps a dark host background/foreground/font onto Fluent neutral tokens', () => {
    const t = hostSignalsToFluentTheme({
      background: '#0d1117',
      backgroundMuted: '#161b22',
      foreground: '#e6edf3',
      foregroundMuted: '#8b949e',
      fontSans: 'Inter, sans-serif',
      fontMono: 'JetBrains Mono, monospace',
    });
    expect(t.colorNeutralBackground1).toBe('#0d1117');
    expect(t.colorNeutralBackground2).toBe('#161b22');
    expect(t.colorNeutralCardBackground).toBe('#161b22');
    expect(t.colorNeutralForeground1).toBe('#e6edf3');
    expect(t.colorNeutralForeground2).toBe('#8b949e');
    expect(t.fontFamilyBase).toBe('Inter, sans-serif');
    expect(t.fontFamilyMonospace).toBe('JetBrains Mono, monospace');
  });

  it('picks a light base theme when the host background is light', () => {
    const dark = hostSignalsToFluentTheme({ background: '#0d1117', foreground: '#ffffff' });
    const light = hostSignalsToFluentTheme({ background: '#ffffff', foreground: '#1f2328' });
    // Fluent dark vs light bases differ in stroke tokens we don't override.
    expect(light.colorNeutralStroke1).not.toBe(dark.colorNeutralStroke1);
  });

  it('reseeds the brand ramp from a host accent (true-color)', () => {
    const noAccent = hostSignalsToFluentTheme({ background: '#0d1117', foreground: '#fff' });
    const withAccent = hostSignalsToFluentTheme({ background: '#0d1117', foreground: '#fff', accent: '#2f81f7' });
    expect(withAccent.colorBrandBackground).not.toBe(noAccent.colorBrandBackground);
  });

  it('ignores an unparseable accent without throwing', () => {
    const t = hostSignalsToFluentTheme({ background: '#0d1117', foreground: '#fff', accent: 'not-a-color' });
    expect(t.colorNeutralBackground1).toBe('#0d1117');
  });

  // Regression (#439 review): short hex and rgb() host colors must drive the
  // base-mode + overrides correctly, not silently fall back to a dark base or
  // be dropped by the hex-only brand generator.
  it('selects a LIGHT base from a short-hex light background (#fff)', () => {
    const light = hostSignalsToFluentTheme({ background: '#fff', foreground: '#111' });
    const dark = hostSignalsToFluentTheme({ background: '#000', foreground: '#fff' });
    expect(light.colorNeutralStroke1).not.toBe(dark.colorNeutralStroke1);
    // Background override is normalized to #rrggbb.
    expect(light.colorNeutralBackground1).toBe('#ffffff');
    expect(light.colorNeutralForeground1).toBe('#111111');
  });

  it('selects a LIGHT base from an rgb() light background', () => {
    const light = hostSignalsToFluentTheme({ background: 'rgb(245, 245, 245)', foreground: 'rgb(20, 20, 20)' });
    const dark = hostSignalsToFluentTheme({ background: 'rgb(13, 17, 23)', foreground: 'rgb(230, 237, 243)' });
    expect(light.colorNeutralStroke1).not.toBe(dark.colorNeutralStroke1);
    expect(light.colorNeutralBackground1).toBe('#f5f5f5');
    expect(dark.colorNeutralBackground1).toBe('#0d1117');
  });

  it('reseeds the brand ramp from a SHORT-HEX accent', () => {
    const noAccent = hostSignalsToFluentTheme({ background: '#0d1117', foreground: '#fff' });
    const shortHex = hostSignalsToFluentTheme({ background: '#0d1117', foreground: '#fff', accent: '#0af' });
    expect(shortHex.colorBrandBackground).not.toBe(noAccent.colorBrandBackground);
  });

  it('reseeds the brand ramp from an rgb() accent', () => {
    const noAccent = hostSignalsToFluentTheme({ background: '#0d1117', foreground: '#fff' });
    const rgbAccent = hostSignalsToFluentTheme({ background: '#0d1117', foreground: '#fff', accent: 'rgb(47, 129, 247)' });
    expect(rgbAccent.colorBrandBackground).not.toBe(noAccent.colorBrandBackground);
  });

  it('folds PresentationTokens typography + corner radius into the theme', () => {
    const t = hostSignalsToFluentTheme(
      { background: '#0d1117', foreground: '#fff' },
      { typography: { baseSizePx: 15, lineHeight: 1.6 }, cornerRadius: { step: 'large' } },
    );
    expect(t.fontSizeBase300).toBe('15px');
    expect(t.lineHeightBase300).toBe('1.6');
    expect(t.borderRadiusMedium).toBe('8px');
    expect(t.borderRadiusLarge).toBe('8px');
    expect(t.borderRadiusSmall).toBe('6px');
  });

  it('honors an explicit cornerRadius.valuePx escape hatch over the step', () => {
    const t = hostSignalsToFluentTheme(
      { background: '#0d1117', foreground: '#fff' },
      { cornerRadius: { step: 'small', valuePx: 12 } },
    );
    expect(t.borderRadiusMedium).toBe('12px');
  });
});

describe('resolveHostFluentTheme', () => {
  const originalGCS = (globalThis as Record<string, unknown>).getComputedStyle;
  const restore = () => {
    if (originalGCS === undefined) delete (globalThis as Record<string, unknown>).getComputedStyle;
    else (globalThis as Record<string, unknown>).getComputedStyle = originalGCS;
  };

  it('returns null with no DOM (SSR/node)', () => {
    delete (globalThis as Record<string, unknown>).getComputedStyle;
    try {
      expect(resolveHostFluentTheme(null)).toBeNull();
    } finally { restore(); }
  });

  it('returns null when the host mirrors no color signal', () => {
    (globalThis as Record<string, unknown>).getComputedStyle = () => ({ getPropertyValue: () => '' });
    try {
      expect(resolveHostFluentTheme({} as Element)).toBeNull();
    } finally { restore(); }
  });

  it('resolves a theme from host vars present on the root', () => {
    (globalThis as Record<string, unknown>).getComputedStyle = () => ({
      getPropertyValue: (n: string) =>
        n === '--background-color-default' ? '#0d1117'
          : n === '--text-color-default' ? '#e6edf3'
            : '',
    });
    try {
      const t = resolveHostFluentTheme({} as Element);
      expect(t).not.toBeNull();
      expect(t!.colorNeutralBackground1).toBe('#0d1117');
      expect(t!.colorNeutralForeground1).toBe('#e6edf3');
    } finally { restore(); }
  });
});
