import { describe, expect, it } from 'vitest';
import {
  parseCanvasBootConfig,
  DEFAULT_CANVAS_BOOT_CONFIG,
} from '../bootConfig';

describe('parseCanvasBootConfig', () => {
  it('returns the full default config for a non-object input', () => {
    for (const raw of [undefined, null, 'x', 42, true]) {
      expect(parseCanvasBootConfig(raw)).toEqual(DEFAULT_CANVAS_BOOT_CONFIG);
    }
  });

  it('defaults visualMode to inherit-host, target to copilot and local to false when absent', () => {
    const cfg = parseCanvasBootConfig({});
    expect(cfg.visualMode).toBe('inherit-host');
    expect(cfg.target).toBe('copilot');
    expect(cfg.local).toBe(false);
    expect(cfg.searchServiceUrl).toBeUndefined();
    expect(cfg.anchorNodeId).toBeUndefined();
  });

  it('accepts a valid full boot object', () => {
    const cfg = parseCanvasBootConfig({
      local: true,
      visualMode: 'inherit-host',
      target: 'spa',
      searchServiceUrl: 'http://127.0.0.1:9099/search',
      anchorNodeId: 'kg://issue/406',
    });
    expect(cfg).toEqual({
      local: true,
      visualMode: 'inherit-host',
      target: 'spa',
      searchServiceUrl: 'http://127.0.0.1:9099/search',
      anchorNodeId: 'kg://issue/406',
    });
  });

  it('accepts the config visual mode', () => {
    expect(parseCanvasBootConfig({ visualMode: 'config' }).visualMode).toBe('config');
  });

  it('accepts the spa and copilot targets', () => {
    expect(parseCanvasBootConfig({ target: 'spa' }).target).toBe('spa');
    expect(parseCanvasBootConfig({ target: 'copilot' }).target).toBe('copilot');
  });

  it('falls back to copilot for an unknown target', () => {
    expect(parseCanvasBootConfig({ target: 'json-ld' }).target).toBe('copilot');
    expect(parseCanvasBootConfig({ target: 42 }).target).toBe('copilot');
  });

  it('falls back to inherit-host for an unknown visualMode', () => {
    expect(parseCanvasBootConfig({ visualMode: 'neon' }).visualMode).toBe('inherit-host');
  });

  it('ignores a non-boolean local', () => {
    expect(parseCanvasBootConfig({ local: 'yes' }).local).toBe(false);
  });

  it('drops empty/whitespace-only string fields', () => {
    const cfg = parseCanvasBootConfig({ searchServiceUrl: '   ', anchorNodeId: '' });
    expect(cfg.searchServiceUrl).toBeUndefined();
    expect(cfg.anchorNodeId).toBeUndefined();
  });

  it('does not mutate the shared default object', () => {
    const cfg = parseCanvasBootConfig({ local: true });
    cfg.visualMode = 'config';
    expect(DEFAULT_CANVAS_BOOT_CONFIG.visualMode).toBe('inherit-host');
  });
});
