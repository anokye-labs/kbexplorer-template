import { test, expect, type Page } from '@playwright/test';

/**
 * CanvasShell — the narrow-column layout primitive (#412, epic #407 / #401).
 *
 * The `copilot` target's routes (`AnchorFirstView`, the constellation zoom-out,
 * the overview) all render inside {@link CanvasShell}. This suite verifies the
 * shell's invariants at a ~400px host width, in both light and dark host tokens
 * (`inherit-host`): no full-page HUD/favicon/dock leak, no horizontal overflow,
 * and the reused node-type viewers stay legible (long titles wrap instead of
 * forcing scroll).
 */

const NARROW_WIDTH = 400;
const NARROW_HEIGHT = 700;

const DARK_HOST = { bg: '#0d1117', fg: '#e6edf3' };
const LIGHT_HOST = { bg: '#ffffff', fg: '#1f2328' };

async function mirrorHostVars(page: Page, host: { bg: string; fg: string }): Promise<void> {
  await page.evaluate(({ bg, fg }) => {
    const r = document.documentElement.style;
    r.setProperty('--background-color-default', bg);
    r.setProperty('--text-color-default', fg);
    r.setProperty('--text-color-link', '#2f81f7');
    r.setProperty('--font-sans', 'system-ui');
  }, host);
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('@griffel')) errors.push(msg.text());
  });
  return errors;
}

function appErrors(errors: string[]): string[] {
  return errors.filter(
    e => !e.includes('403') && !e.includes('rate limit') && !e.includes('Failed to load resource'),
  );
}

/** No element forces the document wider than the (narrow) viewport. */
async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

async function bootCopilotCanvas(page: Page, anchorNodeId = 'readme'): Promise<void> {
  await page.setViewportSize({ width: NARROW_WIDTH, height: NARROW_HEIGHT });
  await page.addInitScript(anchor => {
    (window as unknown as { __KBX_CANVAS__: unknown }).__KBX_CANVAS__ = {
      local: false,
      visualMode: 'inherit-host',
      target: 'copilot',
      anchorNodeId: anchor,
    };
  }, anchorNodeId);
  await page.goto('/canvas.html', { timeout: 60000 });
}

test.describe('CanvasShell narrow column (#412)', () => {
  for (const [label, host] of Object.entries({ dark: DARK_HOST, light: LIGHT_HOST })) {
    test(`~400px host, ${label} tokens: shell renders, no chrome leak, no overflow`, async ({
      page,
    }) => {
      const errors = collectErrors(page);
      await bootCopilotCanvas(page, 'readme');

      const shell = page.locator('[data-testid="canvas-shell"]');
      await expect(shell).toBeVisible({ timeout: 15000 });
      await expect(shell).toHaveAttribute('data-kbx-shell', 'canvas');

      // The anchor-first home renders inside the shell.
      await expect(page.locator('[data-testid="anchor-first-view"]')).toBeVisible({
        timeout: 15000,
      });

      // No full-page HUD chrome (search button, dock controls, etc.).
      await expect(page.locator('[data-testid^="hud-"]')).toHaveCount(0);
      // No favicon takeover — canvas.html serves the empty data-icon.
      const iconHref = await page
        .locator('link[rel="icon"]')
        .first()
        .getAttribute('href');
      expect(iconHref).toBe('data:,');

      // Host tokens honored (inherit-host), not a re-mirrored/hardcoded value.
      await mirrorHostVars(page, host);
      await expect(shell).toHaveCSS('background-color', hexToRgb(host.bg));
      await expect(shell).toHaveCSS('color', hexToRgb(host.fg));

      await expectNoHorizontalOverflow(page);

      await page.waitForTimeout(500);
      expect(appErrors(errors)).toHaveLength(0);
    });
  }

  test('long anchor title wraps instead of overflowing at ~400px', async ({ page }) => {
    await bootCopilotCanvas(page, 'readme');
    await expect(page.locator('[data-testid="anchor-first-view"]')).toBeVisible({
      timeout: 15000,
    });
    await expectNoHorizontalOverflow(page);
  });

  test('navigating expanded neighbors keeps the shell overflow-free', async ({ page }) => {
    await bootCopilotCanvas(page, 'readme');
    await expect(page.locator('[data-testid="anchor-first-view"]')).toBeVisible({
      timeout: 15000,
    });
    await expectNoHorizontalOverflow(page);

    const neighbor = page.locator('[data-testid="anchor-expanded-neighbor"]').first();
    if (await neighbor.count()) {
      await neighbor.locator('a').first().click();
      await expect(page.locator('[data-testid="anchor-first-view"]')).toBeVisible({
        timeout: 15000,
      });
      await expectNoHorizontalOverflow(page);
    }

    // The constellation zoom-out (full-bleed vis-network canvas) also stays
    // within the shell's narrow column bounds.
    await page.locator('[data-testid="constellation-zoom-out"]').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/constellation');
    await page.waitForTimeout(500);
    await expectNoHorizontalOverflow(page);
  });

  test('the shell itself scrolls when content overflows the narrow viewport (not the document)', async ({
    page,
  }) => {
    // `readme` anchors enough content (the anchor's own viewer + up to 6
    // expanded neighbors, each with its own node-intent bar) to exceed the
    // 700px narrow-viewport height used across this suite, exercising the
    // #454-review-flagged `height: 100vh` / `overflowY: 'auto'` fix: the
    // SHELL should be the scroll container, not `document.documentElement`.
    await bootCopilotCanvas(page, 'readme');
    const shell = page.locator('[data-testid="canvas-shell"]');
    await expect(shell).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="anchor-first-view"]')).toBeVisible({
      timeout: 15000,
    });
    await page.waitForTimeout(500);

    const shellMetrics = await shell.evaluate(el => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    // The shell's own content overflows its box — proof `overflowY: 'auto'`
    // has something to actually engage on (a genuine scroll container, not
    // an inert style on a box that never grows past its content).
    expect(shellMetrics.scrollHeight).toBeGreaterThan(shellMetrics.clientHeight);

    // The OUTER document does not grow to accommodate that overflow — it
    // stays pinned to the host viewport height, meaning the shell (not the
    // page) is what scrolls.
    const docMetrics = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }));
    expect(docMetrics.scrollHeight).toBeLessThanOrEqual(docMetrics.clientHeight + 1);
  });
});

/** Convert a `#rrggbb` hex color to the `rgb(r, g, b)` string Playwright's toHaveCSS expects. */
function hexToRgb(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgb(${r}, ${g}, ${b})`;
}
