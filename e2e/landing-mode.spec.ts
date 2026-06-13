/**
 * E2E spec for landing-mode config (#238).
 *
 * Covers:
 *   - landing.view=reading + landing.graph=collapsed → reading view, collapsed HUD.
 *   - landing.view=overview → overview route.
 *   - deep links are always honored (hash routes override landing config).
 *   - localStorage user preference wins over config-driven HUD state.
 *
 * Config fixturing follows the same pattern as search.spec.ts: intercept the
 * local-mode manifest asset and the remote-mode GitHub contents API response,
 * patching configRaw with the desired landing block.
 */

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const manifestPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/generated/repo-manifest.json',
);

type LandingConfig = {
  view?: 'reading' | 'overview' | 'graph';
  node?: string;
  graph?: 'collapsed' | 'expanded';
};

function patchedManifest(landing: LandingConfig): { manifest: Record<string, unknown>; configRaw: string } {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>;
  const config = (manifest.configRaw ? YAML.parse(manifest.configRaw as string) : null) ?? {};
  config.landing = landing;
  const configRaw = YAML.stringify(config);
  manifest.configRaw = configRaw;
  return { manifest, configRaw };
}

async function routeWithLanding(
  page: import('@playwright/test').Page,
  landing: LandingConfig,
): Promise<void> {
  const { manifest, configRaw } = patchedManifest(landing);

  // Local-mode: intercept the lazy manifest chunk.
  await page.route('**/assets/repo-manifest-*.js', route => {
    void route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `export default ${JSON.stringify(manifest)};`,
    });
  });

  // Remote-mode: intercept the GitHub contents API for config.yaml.
  await page.route('**/contents/**config.yaml*', route => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: Buffer.from(configRaw).toString('base64'),
        sha: 'e2e-landing-mode',
        encoding: 'base64',
      }),
    });
  });
}

/** Wait for the app to be ready: HUD visible (expanded or collapsed). */
async function waitForApp(page: import('@playwright/test').Page): Promise<void> {
  // When the HUD is expanded the "Cards" button is visible; when collapsed the
  // "Expand" button is visible. Waiting for either covers both states.
  // We use the kb-prose or the HUD's lowest-common-denominator element.
  // Actually the safest signal is the reading view prose appearing (which
  // always loads for /node/* routes regardless of HUD state) OR the overview
  // grid (for /overview). We accept either.
  await page.waitForFunction(() => {
    const prose = document.querySelector('.kb-prose');
    const cards = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Cards');
    const expand = Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('title') === 'Expand');
    return !!(prose || cards || expand);
  }, { timeout: 45000 });
}

test.describe('Landing mode: reading-first with collapsed graph', () => {
  test('landing.view=reading + landing.graph=collapsed → reading view with collapsed HUD', async ({ page }) => {
    // Clear any stored HUD preference so the config wins.
    await page.addInitScript(() => {
      localStorage.removeItem('kbe-hud-collapsed');
    });

    await routeWithLanding(page, { view: 'reading', graph: 'collapsed' });

    // Navigate to `/` — the landing config should redirect to a reading node.
    await page.goto('/', { timeout: 60000 });
    await waitForApp(page);

    // The URL should be a /node/ path (reading view), not /overview.
    await expect(page).toHaveURL(/\/#\/node\//, { timeout: 10000 });

    // Reading view prose should be visible.
    await expect(page.locator('.kb-prose')).toBeVisible({ timeout: 10000 });

    // HUD should be collapsed: the expand button should be present and the
    // HUD should be in its collapsed (rail) state.
    // The collapsed HUD has an expand button (ChevronUpRegular for bottom dock).
    // We detect the collapsed state by the absence of the Cards button that lives
    // only in the expanded HUD content.
    const expandButton = page.locator('[title="Expand"]');
    await expect(expandButton).toBeVisible({ timeout: 5000 });
  });

  test('landing.view=reading + custom node → navigates to that node', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('kbe-hud-collapsed');
    });

    await routeWithLanding(page, { view: 'reading', node: 'readme' });
    await page.goto('/', { timeout: 60000 });
    await waitForApp(page);

    // Should land on the readme node.
    await expect(page).toHaveURL(/\/#\/node\/readme/, { timeout: 10000 });
    await expect(page.locator('.kb-prose')).toBeVisible({ timeout: 10000 });
  });

  test('landing.view=overview → card-grid overview', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('kbe-hud-collapsed');
    });

    await routeWithLanding(page, { view: 'overview' });
    await page.goto('/', { timeout: 60000 });
    await waitForApp(page);

    await expect(page).toHaveURL(/\/#\/overview/, { timeout: 10000 });
  });

  test('deep links bypass landing config', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('kbe-hud-collapsed');
    });

    // Config says land on overview, but we navigate directly to a node.
    await routeWithLanding(page, { view: 'overview' });
    await page.goto('/#/node/readme', { timeout: 60000 });
    await waitForApp(page);

    // Deep link wins — should still be on /node/readme.
    await expect(page).toHaveURL(/\/#\/node\/readme/, { timeout: 10000 });
    await expect(page.locator('.kb-prose')).toBeVisible({ timeout: 10000 });
  });

  test('localStorage HUD preference wins over config.landing.graph=collapsed', async ({ page }) => {
    // Pre-seed the stored preference to "false" (user previously expanded).
    await page.addInitScript(() => {
      localStorage.setItem('kbe-hud-collapsed', 'false');
    });

    await routeWithLanding(page, { view: 'reading', graph: 'collapsed' });
    await page.goto('/', { timeout: 60000 });
    await waitForApp(page);

    // HUD should be expanded (Cards button visible in HUD).
    await expect(page.getByRole('button', { name: 'Cards' })).toBeVisible({ timeout: 10000 });

    // The Expand button should NOT be visible (HUD is not collapsed).
    await expect(page.locator('[title="Expand"]')).not.toBeVisible({ timeout: 3000 });
  });
});
