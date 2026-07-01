import { test, expect } from '@playwright/test';

/**
 * Embeddable canvas mount (#406) + bespoke copilot target (#440) + anchor-first
 * home view (#408). Verifies the additive `canvas.html` surface: it boots from
 * `window.__KBX_CANVAS__`, inherits the host theme mirrored onto the iframe
 * `:root` (inherit-host — including live re-mirror on a host theme switch),
 * renders non-blank, and logs no console errors — WITHOUT the full-page
 * favicon/HUD chrome.
 *
 * The default `copilot` target now renders the anchor-first landing (#408): the
 * conversation anchor node + its weight-ranked neighbors, with `kg://` chips for
 * the unexpanded remainder and the constellation demoted to an optional
 * zoom-out. The `spa` target remains as an escape hatch (route tree + viewers).
 */

const HOST_BG = 'rgb(13, 17, 23)'; // #0d1117 — GitHub dark canvas
const HOST_FG = 'rgb(230, 237, 243)'; // #e6edf3

/** Mirror the host's semantic CSS vars onto the iframe root (as a host would). */
async function mirrorHostVars(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const r = document.documentElement.style;
    r.setProperty('--background-color-default', '#0d1117');
    r.setProperty('--text-color-default', '#e6edf3');
    r.setProperty('--text-color-link', '#2f81f7');
    r.setProperty('--font-sans', 'system-ui');
  });
}

function collectErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('@griffel')) errors.push(msg.text());
  });
  return errors;
}

function appErrors(errors: string[]): string[] {
  // Ignore infra noise: twin rate-limits (403) and missing image bytes the twin
  // serves as 404 for `img` assets (README hero / sprites) — neither is an app
  // or JS error surfaced by the anchor-first view.
  return errors.filter(
    e =>
      !e.includes('403') &&
      !e.includes('rate limit') &&
      !e.includes('Failed to load resource'),
  );
}

test.describe('Embeddable canvas mount (#406 / #440 / #408)', () => {
  test('spa escape hatch: boots host-themed, reuses the reading viewer', async ({ page }) => {
    const errors = collectErrors(page);

    // The loopback host injects the boot config before app code runs.
    await page.addInitScript(() => {
      (window as unknown as { __KBX_CANVAS__: unknown }).__KBX_CANVAS__ = {
        local: false,
        visualMode: 'inherit-host',
        target: 'spa',
        anchorNodeId: 'readme',
      };
    });
    await page.goto('/canvas.html', { timeout: 60000 });

    // Reused `spa` reading viewer renders the anchored node's prose — non-blank.
    await expect(page.locator('.kb-prose')).toBeVisible({ timeout: 15000 });
    // anchorNodeId from the boot config lands on /node/<id> (HashRouter).
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/node/readme');

    const surface = page.locator('[data-kbx-surface="canvas"]');
    await expect(surface).toBeVisible();
    await expect(surface).toHaveAttribute('data-kbx-target', 'spa');

    // Host mirrors its semantic vars → inherit-host re-resolves (MutationObserver).
    await mirrorHostVars(page);
    await expect(surface).toHaveCSS('background-color', HOST_BG);
    await expect(surface).toHaveCSS('color', HOST_FG);

    // Headless entry: the canvas HTML, not the full-page index.html.
    await expect(page).toHaveTitle(/kbexplorer canvas/);

    await page.waitForTimeout(1000);
    expect(appErrors(errors)).toHaveLength(0);
  });

  test('copilot (default): anchor-first home renders the anchor + neighbors (#408)', async ({
    page,
  }) => {
    const errors = collectErrors(page);

    // Boot with NO explicit target — the canvas surface defaults to `copilot`.
    await page.addInitScript(() => {
      (window as unknown as { __KBX_CANVAS__: unknown }).__KBX_CANVAS__ = {
        local: false,
        visualMode: 'inherit-host',
        anchorNodeId: 'readme',
      };
    });
    await page.goto('/canvas.html', { timeout: 60000 });

    const surface = page.locator('[data-kbx-surface="canvas"]');
    await expect(surface).toBeVisible({ timeout: 15000 });
    // The registry-selected target the canvas resolved is `copilot`, not `spa`.
    await expect(surface).toHaveAttribute('data-kbx-target', 'copilot');

    // The default landing is the anchor-first home (NOT the constellation): the
    // conversation anchor is featured, anchored on /node/readme (HashRouter).
    const anchorView = page.locator('[data-testid="anchor-first-view"]');
    await expect(anchorView).toBeVisible({ timeout: 15000 });
    await expect(anchorView).toHaveAttribute('data-anchor-id', 'readme');
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/node/readme');

    // Its weight-ranked neighbors are present, expanded inline...
    await expect(page.locator('[data-testid="anchor-expanded-neighbor"]').first()).toBeVisible();
    // ...and the constellation is an optional zoom-out affordance, not the landing.
    await expect(page.locator('[data-testid="constellation-zoom-out"]')).toBeVisible();

    // Host-themed via inherit-host (semantic vars mirrored onto the iframe root).
    await mirrorHostVars(page);
    await expect(surface).toHaveCSS('background-color', HOST_BG);
    await expect(surface).toHaveCSS('color', HOST_FG);

    await page.waitForTimeout(1000);
    expect(appErrors(errors)).toHaveLength(0);
  });

  test('copilot: kg:// chips re-anchor and the constellation is reachable (#408)', async ({
    page,
  }) => {
    const errors = collectErrors(page);

    await page.addInitScript(() => {
      (window as unknown as { __KBX_CANVAS__: unknown }).__KBX_CANVAS__ = {
        local: false,
        visualMode: 'inherit-host',
        anchorNodeId: 'readme',
      };
    });
    await page.goto('/canvas.html', { timeout: 60000 });

    await expect(page.locator('[data-testid="anchor-first-view"]')).toBeVisible({ timeout: 15000 });

    // A relevant-but-unexpanded neighbor is a navigable kg:// chip. Clicking it
    // re-anchors the view on that node (HashRouter /node/<id>).
    const chip = page.locator('[data-testid="anchor-neighbor-chip"]').first();
    await expect(chip).toBeVisible();
    const chipNodeId = await chip.getAttribute('data-node-id');
    expect(chipNodeId).toBeTruthy();
    await chip.click();
    await expect
      .poll(() => page.evaluate(() => location.hash))
      .toBe(`#/node/${encodeURIComponent(chipNodeId as string)}`);
    await expect(page.locator('[data-testid="anchor-first-view"]')).toHaveAttribute(
      'data-anchor-id',
      chipNodeId as string,
    );

    // The constellation zoom-out is reachable from the anchor-first home.
    await page.locator('[data-testid="constellation-zoom-out"]').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/constellation');
    await expect(page.getByText('Knowledge Clusters')).toBeVisible({ timeout: 15000 });

    await page.waitForTimeout(500);
    expect(appErrors(errors)).toHaveLength(0);
  });
});
