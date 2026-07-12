import { describe, expect, it } from 'vitest';

import {
  VIEW_API_VERSION,
  checkViewCompatibility,
  type ViewCompatibility,
} from '../src/index';

describe('VIEW_API_VERSION', () => {
  it('is a semver string', () => {
    expect(VIEW_API_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('is versioned independently — a bare, self-contained constant', () => {
    // The view contract is bumped on its own cadence, not core's; assert it is a
    // plain string literal this package owns (no import from core).
    expect(typeof VIEW_API_VERSION).toBe('string');
  });
});

describe('checkViewCompatibility', () => {
  it('accepts a render half that makes no version claim (undefined)', () => {
    expect(checkViewCompatibility(undefined)).toEqual({ compatible: true });
  });

  it('accepts the exact host version', () => {
    expect(checkViewCompatibility(VIEW_API_VERSION)).toEqual({ compatible: true });
  });

  it('accepts a same-major, same-or-older minor', () => {
    expect(checkViewCompatibility('1.0.0', '1.2.0')).toEqual({ compatible: true });
  });

  it('rejects a different major version and names the mismatch', () => {
    const result: ViewCompatibility = checkViewCompatibility('2.0.0', VIEW_API_VERSION);
    expect(result.compatible).toBe(false);
    expect(result.reason).toContain('2.0.0');
    expect(result.reason).toContain(VIEW_API_VERSION);
    expect(result.reason).toMatch(/major/);
  });

  it('rejects a same-major render half that needs a newer minor than the host', () => {
    const result = checkViewCompatibility('1.9.0', '1.2.0');
    expect(result.compatible).toBe(false);
    expect(result.reason).toMatch(/minor/);
  });

  it('rejects a malformed version', () => {
    const result = checkViewCompatibility('banana');
    expect(result.compatible).toBe(false);
    expect(result.reason).toContain('malformed');
    expect(result.reason).toContain('banana');
  });

  it('defaults the host version to VIEW_API_VERSION when omitted', () => {
    expect(checkViewCompatibility('2.0.0')).toEqual({
      compatible: false,
      reason: expect.stringContaining(VIEW_API_VERSION),
    });
  });
});
