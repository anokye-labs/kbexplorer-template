/**
 * Unit tests for landing-mode resolution logic (#238).
 *
 * Covers:
 *   - resolveLandingPath: all view modes, custom node, defaults.
 *   - resolveLandingHudCollapsed: config vs localStorage precedence.
 */

import { describe, it, expect } from 'vitest';
import { resolveLandingPath, resolveLandingHudCollapsed } from '../resolveLanding';
import { DEFAULT_CONFIG } from '../../types';
import type { KBConfig } from '../../types';

// ── Helpers ────────────────────────────────────────────────────────────────

function withLanding(overrides: KBConfig['landing']): KBConfig {
  return { ...DEFAULT_CONFIG, landing: overrides };
}

// ── resolveLandingPath ─────────────────────────────────────────────────────

describe('resolveLandingPath', () => {
  it('defaults to /node/home when no landing config is present', () => {
    expect(resolveLandingPath(DEFAULT_CONFIG)).toBe('/node/home');
  });

  it('defaults to /node/home when landing block is empty', () => {
    expect(resolveLandingPath(withLanding({}))).toBe('/node/home');
  });

  it('view: reading → /node/home when no node is specified', () => {
    expect(resolveLandingPath(withLanding({ view: 'reading' }))).toBe('/node/home');
  });

  it('view: reading + node → /node/<id>', () => {
    expect(resolveLandingPath(withLanding({ view: 'reading', node: 'team-charter' })))
      .toBe('/node/team-charter');
  });

  it('view: overview → /overview', () => {
    expect(resolveLandingPath(withLanding({ view: 'overview' }))).toBe('/overview');
  });

  it('view: overview ignores node field', () => {
    expect(resolveLandingPath(withLanding({ view: 'overview', node: 'some-node' })))
      .toBe('/overview');
  });

  it('view: graph → /node/home (same as no-config default)', () => {
    expect(resolveLandingPath(withLanding({ view: 'graph' }))).toBe('/node/home');
  });

  it('view: graph + node → /node/<id>', () => {
    expect(resolveLandingPath(withLanding({ view: 'graph', node: 'overview' })))
      .toBe('/node/overview');
  });

  it('URI-encodes node IDs that contain special characters', () => {
    expect(resolveLandingPath(withLanding({ view: 'reading', node: 'team/charter' })))
      .toBe('/node/team%2Fcharter');
  });
});

// ── resolveLandingHudCollapsed ─────────────────────────────────────────────

describe('resolveLandingHudCollapsed', () => {
  // Scenario A: no stored preference, no config → default (expanded = false)
  it('returns false (expanded) by default with no config and no stored pref', () => {
    expect(resolveLandingHudCollapsed(DEFAULT_CONFIG, null)).toBe(false);
  });

  // Scenario B: no stored preference, config says collapsed
  it('returns true when config.landing.graph=collapsed and no stored pref', () => {
    expect(resolveLandingHudCollapsed(withLanding({ graph: 'collapsed' }), null))
      .toBe(true);
  });

  // Scenario C: no stored preference, config says expanded explicitly
  it('returns false when config.landing.graph=expanded and no stored pref', () => {
    expect(resolveLandingHudCollapsed(withLanding({ graph: 'expanded' }), null))
      .toBe(false);
  });

  // Scenario D: localStorage wins — user expanded (stored='false')
  it('returns false when stored pref is "false" even if config says collapsed', () => {
    expect(resolveLandingHudCollapsed(withLanding({ graph: 'collapsed' }), 'false'))
      .toBe(false);
  });

  // Scenario E: localStorage wins — user collapsed (stored='true')
  it('returns true when stored pref is "true" even if config says expanded', () => {
    expect(resolveLandingHudCollapsed(withLanding({ graph: 'expanded' }), 'true'))
      .toBe(true);
  });

  // Scenario F: stored pref is "true", no landing config
  it('returns true when stored pref is "true" and no landing config', () => {
    expect(resolveLandingHudCollapsed(DEFAULT_CONFIG, 'true')).toBe(true);
  });

  // Scenario G: stored pref is "false", no landing config
  it('returns false when stored pref is "false" and no landing config', () => {
    expect(resolveLandingHudCollapsed(DEFAULT_CONFIG, 'false')).toBe(false);
  });

  // Scenario H: empty landing block, no stored pref → default expanded
  it('returns false when landing block is empty and no stored pref', () => {
    expect(resolveLandingHudCollapsed(withLanding({}), null)).toBe(false);
  });
});
