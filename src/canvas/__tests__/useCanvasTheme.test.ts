import { afterEach, describe, expect, it } from 'vitest';
import { webDarkTheme, webLightTheme } from '@fluentui/react-components';
import { resolveCanvasTheme } from '../useCanvasTheme';
import { isDarkTheme } from '../../hooks/useTheme';
import type { KBConfig } from '../../types';

/** Install a fake `getComputedStyle` that returns the given host CSS vars. */
function stubHostVars(vars: Record<string, string>): void {
  (globalThis as unknown as { getComputedStyle: unknown }).getComputedStyle = () => ({
    getPropertyValue: (name: string) => vars[name] ?? '',
  });
}

afterEach(() => {
  delete (globalThis as unknown as { getComputedStyle?: unknown }).getComputedStyle;
});

const fakeRoot = {} as Element;

describe('resolveCanvasTheme', () => {
  it('inherit-host adopts the host background/foreground when mirrored', () => {
    stubHostVars({
      '--background-color-default': '#0d1117',
      '--text-color-default': '#e6edf3',
    });
    const theme = resolveCanvasTheme('inherit-host', undefined, fakeRoot);
    expect(theme.colorNeutralBackground1).toBe('#0d1117');
    expect(theme.colorNeutralForeground1).toBe('#e6edf3');
    expect(isDarkTheme(theme)).toBe(true);
  });

  it('inherit-host picks a light base from a light host background', () => {
    stubHostVars({
      '--background-color-default': '#ffffff',
      '--text-color-default': '#1f2328',
    });
    const theme = resolveCanvasTheme('inherit-host', undefined, fakeRoot);
    expect(isDarkTheme(theme)).toBe(false);
  });

  it('inherit-host falls back to the config theme when the host mirrors nothing', () => {
    // No getComputedStyle stub ⇒ resolveHostFluentTheme returns null.
    const theme = resolveCanvasTheme('inherit-host', undefined, fakeRoot);
    expect(theme.colorNeutralBackground1).toBe(webDarkTheme.colorNeutralBackground1);
  });

  it('config mode ignores host vars and uses the configured default theme', () => {
    stubHostVars({
      '--background-color-default': '#0d1117',
      '--text-color-default': '#e6edf3',
    });
    const config = { theme: { default: 'light' } } as unknown as KBConfig;
    const theme = resolveCanvasTheme('config', config, fakeRoot);
    expect(theme.colorNeutralBackground1).toBe(webLightTheme.colorNeutralBackground1);
    expect(isDarkTheme(theme)).toBe(false);
  });

  it('config mode with no config resolves to the dark built-in', () => {
    const theme = resolveCanvasTheme('config', undefined, fakeRoot);
    expect(theme.colorNeutralBackground1).toBe(webDarkTheme.colorNeutralBackground1);
  });
});
