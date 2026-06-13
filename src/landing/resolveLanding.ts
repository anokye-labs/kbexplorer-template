/**
 * Landing-mode resolution (#238).
 *
 * Pure functions: no React, no side effects, no localStorage reads — all
 * inputs are explicit so the logic is unit-testable in isolation.
 */

import type { KBConfig } from '../types';

/**
 * The resolved initial destination for the app when the user lands at `/`
 * with no deep-link hash.
 */
export interface LandingDestination {
  /** Hash-router path, e.g. `/node/home` or `/overview`. */
  path: string;
}

/**
 * Resolve the initial route path from the landing config.
 *
 * Called only when the user arrives at `/` (no deep-link hash).
 * Deep links (`#/node/x`, `#/overview`) bypass this entirely.
 *
 * @param config - The loaded KB config.
 * @returns The hash-router path to navigate to.
 */
export function resolveLandingPath(config: KBConfig): string {
  const landing = config.landing;
  if (!landing) return '/node/home';

  switch (landing.view) {
    case 'overview':
      return '/overview';
    case 'reading':
    case 'graph':
    default: {
      // Both 'reading' and 'graph' land on a node; 'graph' just leaves the
      // HUD expanded (handled separately in resolveLandingHudCollapsed).
      const nodeId = landing.node ?? 'home';
      return `/node/${encodeURIComponent(nodeId)}`;
    }
  }
}

/**
 * Resolve the initial HUD collapsed state, honoring the config ONLY when
 * the user has no stored preference.
 *
 * Precedence (highest first):
 *   1. localStorage `kbe-hud-collapsed` (user's explicit choice after first
 *      interaction) — wins always.
 *   2. `config.landing.graph === 'collapsed'` — config-driven initial state.
 *   3. Default: `false` (HUD expanded).
 *
 * @param config          - The loaded KB config.
 * @param storedPreference - The raw value of `localStorage.getItem('kbe-hud-collapsed')`,
 *                           or `null` if the key is absent / localStorage is
 *                           unavailable.
 * @returns `true` if the HUD should start collapsed.
 */
export function resolveLandingHudCollapsed(
  config: KBConfig,
  storedPreference: string | null,
): boolean {
  // User preference wins after first interaction.
  if (storedPreference !== null) {
    return storedPreference === 'true';
  }

  // No stored preference: honor the config.
  return config.landing?.graph === 'collapsed';
}
