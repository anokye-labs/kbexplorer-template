import { describe, it, expect } from 'vitest';
import yaml from 'yaml';
import { DEFAULT_CONFIG } from '../index';
import type { KBConfig } from '../index';

// Mirrors the parse + shallow-merge that loadConfig() performs in
// src/engine/parser.ts (same approach as theme-config-schema.test.ts).
// Validates the additive `features.search` flag: defaults on, host repos
// opt out with `features.search: false`, and a host `features:` block that
// omits `search` still resolves as enabled via the App-side `!== false` check.

function parseConfigYaml(raw: string): KBConfig {
  const source = DEFAULT_CONFIG.source;
  const parsed = yaml.parse(raw) as Partial<KBConfig>;
  return { ...DEFAULT_CONFIG, ...parsed, source };
}

// The exact enablement predicate App.tsx uses.
const searchEnabled = (config: KBConfig) => config.features?.search !== false;

describe('KBConfig.features.search flag', () => {
  it('defaults to enabled in DEFAULT_CONFIG', () => {
    expect(DEFAULT_CONFIG.features.search).toBe(true);
    expect(searchEnabled(DEFAULT_CONFIG)).toBe(true);
  });

  it('stays enabled when the host config has no features block', () => {
    const config = parseConfigYaml(`
title: Host KB
`);
    expect(searchEnabled(config)).toBe(true);
  });

  it('stays enabled when the host features block omits search (shallow merge)', () => {
    const config = parseConfigYaml(`
features:
  hud: true
  minimap: false
`);
    // Shallow merge replaces the whole features object, so search is
    // undefined here — the `!== false` check must still mean enabled.
    expect(config.features.search).toBeUndefined();
    expect(searchEnabled(config)).toBe(true);
  });

  it('disables when the host sets features.search: false', () => {
    const config = parseConfigYaml(`
features:
  hud: true
  search: false
`);
    expect(config.features.search).toBe(false);
    expect(searchEnabled(config)).toBe(false);
  });
});
