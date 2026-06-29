import { describe, expect, it } from 'vitest';
import type { KBConfig } from '../../types';
import {
  DEFAULT_STRUCTURED_CONTENT_PATH,
  normalizeRepoRelativeDir,
  resolveStructuredContentPath,
} from '../structured-content';

const config = {} as KBConfig;

describe('structured content config', () => {
  it('preserves content-model as the default path', () => {
    expect(resolveStructuredContentPath(config, {})).toBe(DEFAULT_STRUCTURED_CONTENT_PATH);
  });

  it('reads the preferred structuredContent.path config field', () => {
    const configured = {
      structuredContent: { path: 'docs/team-model/' },
    } as KBConfig & { structuredContent: { path: string } };

    expect(resolveStructuredContentPath(configured, {})).toBe('docs/team-model');
  });

  it('lets env override config for build/runtime parity', () => {
    const configured = {
      structuredContent: { path: 'docs/team-model' },
    } as KBConfig & { structuredContent: { path: string } };

    expect(resolveStructuredContentPath(configured, {
      VITE_KB_STRUCTURED_CONTENT_PATH: 'ops/model',
    })).toBe('ops/model');
  });

  it('normalizes Windows separators and rejects unsafe paths', () => {
    expect(normalizeRepoRelativeDir('ops\\model\\')).toBe('ops/model');
    expect(normalizeRepoRelativeDir('../secrets')).toBeNull();
    expect(normalizeRepoRelativeDir('/tmp/model')).toBeNull();
    expect(normalizeRepoRelativeDir('https://example.com/model')).toBeNull();
  });
});
