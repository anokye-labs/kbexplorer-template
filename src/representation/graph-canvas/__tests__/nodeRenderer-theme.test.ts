import { describe, it, expect, afterEach } from 'vitest';
import { resolveNodeTheme } from '../nodeRenderer';

describe('resolveNodeTheme', () => {
  const originalGCS = (globalThis as Record<string, unknown>).getComputedStyle;

  afterEach(() => {
    if (originalGCS === undefined) delete (globalThis as Record<string, unknown>).getComputedStyle;
    else (globalThis as Record<string, unknown>).getComputedStyle = originalGCS;
  });

  it('falls back to the dark hardcodes when the DOM is unavailable', () => {
    delete (globalThis as Record<string, unknown>).getComputedStyle;
    const t = resolveNodeTheme(null, true);
    expect(t.isDark).toBe(true);
    expect(t.foreground).toBe('#d6d6d6');
    expect(t.background).toBe('#1f1f1f');
    expect(t.iconColor).toBe('rgba(255,255,255,0.9)');
  });

  it('falls back to the light hardcodes when isDark hint is false', () => {
    delete (globalThis as Record<string, unknown>).getComputedStyle;
    const t = resolveNodeTheme(null, false);
    expect(t.isDark).toBe(false);
    expect(t.foreground).toBe('#242424');
    expect(t.background).toBe('#ffffff');
    expect(t.iconColor).toBe('rgba(0,0,0,0.85)');
  });

  it('reads foreground/background from CSS vars and derives isDark from luminance', () => {
    (globalThis as Record<string, unknown>).getComputedStyle = () => ({
      getPropertyValue: (name: string) =>
        name === '--colorNeutralForeground2' ? '#222222'
          : name === '--colorNeutralBackground1' ? '#f5ecd7'
            : '',
    });
    const t = resolveNodeTheme({} as Element, true);
    expect(t.foreground).toBe('#222222');
    expect(t.background).toBe('#f5ecd7');
    // Light sepia-like background => not dark, despite the dark hint.
    expect(t.isDark).toBe(false);
    expect(t.iconColor).toBe('rgba(0,0,0,0.85)');
  });

  it('derives isDark from an rgb() background string', () => {
    (globalThis as Record<string, unknown>).getComputedStyle = () => ({
      getPropertyValue: (name: string) =>
        name === '--colorNeutralBackground1' ? 'rgb(20, 20, 24)' : '',
    });
    const t = resolveNodeTheme({} as Element, false);
    expect(t.isDark).toBe(true);
  });
});
