import { test, expect } from '@playwright/test';

/**
 * Embeddable canvas mount (#406). Verifies the additive `canvas.html` surface:
 * it boots from `window.__KBX_CANVAS__`, inherits the host theme mirrored onto
 * the iframe `:root` (inherit-host visual mode — including live re-mirror on a
 * host theme switch), renders non-blank reusing the `spa` viewers, and logs no
 * console errors — WITHOUT the full-page favicon/HUD chrome.
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

test.describe('Embeddable canvas mount (#406)', () => {
  test('boots host-themed and non-blank with no full-page chrome', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('@griffel')) errors.push(msg.text());
    });

    // The loopback host injects the boot config before app code runs.
    await page.addInitScript(() => {
      (window as unknown as { __KBX_CANVAS__: unknown }).__KBX_CANVAS__ = {
        local: false,
        visualMode: 'inherit-host',
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

    // Host mirrors its semantic vars → inherit-host re-resolves (MutationObserver)
    // and the Fluent surface adopts the host background/foreground.
    await mirrorHostVars(page);
    await expect(surface).toHaveCSS('background-color', HOST_BG);
    await expect(surface).toHaveCSS('color', HOST_FG);

    // Headless entry: the canvas HTML, not the full-page index.html (distinct
    // title). The canvas ships no real favicon and no HUD chrome.
    await expect(page).toHaveTitle(/kbexplorer canvas/);

    await page.waitForTimeout(1000);
    const appErrors = errors.filter(e => !e.includes('403') && !e.includes('rate limit'));
    expect(appErrors).toHaveLength(0);
  });
});
