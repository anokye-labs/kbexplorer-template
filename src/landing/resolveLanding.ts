/**
 * Landing-mode resolution (#238).
 *
 * Pure functions: no React, no side effects, no localStorage reads — all
 * inputs are explicit so the logic is unit-testable in isolation.
 */

import type { KBConfig } from '../types';

/**
 * Resolve the initial route path from the landing config.
 *
 * Called only when the user arrives at `/` (no deep-link hash).
 * Deep links (`#/node/x`, `#/overview`) bypass this entirely.
 *
 * Two distinct node defaults, because `/node/home` is a special route:
 *  - `'graph'` (and the no-config default) → `/node/home`, the graph-first
 *    **HomePage** (hero + graph), preserving today's behavior.
 *  - `'reading'` → `/node/readme`, a content node rendered by the normal
 *    **ReadingView**. Defaulting reading to `home` would land on the very
 *    graph-first homepage that reading-first mode exists to replace.
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
    case 'reading': {
      // Reading-first: a content node in ReadingView, NOT the graph HomePage.
      const nodeId = landing.node ?? 'readme';
      return `/node/${encodeURIComponent(nodeId)}`;
    }
    case 'graph':
    default: {
      // Graph-first: the HomePage route leaves the graph immediately visible.
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
