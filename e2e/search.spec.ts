/**
 * E2E spec for the search palette.
 *
 * Covers the primary user journey described in issue #237:
 *   open palette → type → navigate with Enter → lands on the node in reading view.
 *
 * Also covers: Ctrl-K shortcut, HUD search button, Esc to close.
 */
import { test, expect } from '@playwright/test';

/** Wait until the app has finished loading (loading screen gone, HUD visible). */
async function waitForApp(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/#/node/readme', { timeout: 60000 });
  // Wait for the loading screen to disappear by waiting for the HUD element.
  // The HUD renders immediately once the knowledge base is ready.
  await expect(page.getByTestId('hud-search-button')).toBeVisible({ timeout: 45000 });
}

test.describe('Search palette', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page);
  });

  test('HUD search button opens the palette', async ({ page }) => {
    await page.getByTestId('hud-search-button').click();
    await expect(page.getByTestId('search-dialog')).toBeVisible({ timeout: 5000 });
  });

  test('Ctrl-K opens the palette', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId('search-dialog')).toBeVisible({ timeout: 5000 });
  });

  test('/ key opens the palette when not in an input', async ({ page }) => {
    // Click body area to ensure focus is not in an input
    await page.locator('body').click({ position: { x: 200, y: 300 } });
    await page.keyboard.press('/');
    await expect(page.getByTestId('search-dialog')).toBeVisible({ timeout: 5000 });
  });

  test('Esc closes the palette', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId('search-dialog')).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('search-dialog')).not.toBeVisible({ timeout: 5000 });
  });

  test('overlay backdrop click closes the palette', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await expect(page.getByTestId('search-dialog')).toBeVisible({ timeout: 5000 });
    // Click the overlay at top-left (outside the centered dialog box)
    await page.getByTestId('search-overlay').click({ position: { x: 10, y: 10 } });
    await expect(page.getByTestId('search-dialog')).not.toBeVisible({ timeout: 5000 });
  });

  test('type → results appear', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const input = page.getByTestId('search-input');
    await expect(input).toBeVisible({ timeout: 5000 });
    // Give the index a moment to be built after graph is ready
    await page.waitForTimeout(500);
    await input.fill('readme');
    await expect(
      page.getByTestId('search-results').locator('[role="option"]').first()
    ).toBeVisible({ timeout: 5000 });
  });

  /**
   * Primary journey: open palette → type → Enter → lands on the node.
   * This is the spec-required e2e coverage for issue #237.
   */
  test('open palette → type → Enter → navigates to the node in reading view', async ({ page }) => {
    // Open the palette
    await page.keyboard.press('Control+k');
    const dialog = page.getByTestId('search-dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const input = page.getByTestId('search-input');
    await page.waitForTimeout(500); // index build settle

    // Type a query
    await input.fill('readme');

    // Wait for the first result
    const firstResult = page.getByTestId('search-result-0');
    await expect(firstResult).toBeVisible({ timeout: 5000 });

    // Press Enter to navigate to it
    await page.keyboard.press('Enter');

    // Palette closes
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // URL contains a /node/ path (navigated to a reading view)
    await expect(page).toHaveURL(/\/#\/node\//, { timeout: 10000 });
  });

  test('arrow keys move the active result', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const input = page.getByTestId('search-input');
    await expect(input).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);
    await input.fill('readme');

    // Wait for at least 1 result to be present
    await expect(
      page.getByTestId('search-results').locator('[role="option"]').first()
    ).toBeVisible({ timeout: 5000 });

    // First result is selected initially
    await expect(page.locator('[id="search-result-0"][aria-selected="true"]')).toBeVisible();

    // ArrowDown selects the next one (if there are multiple)
    const resultCount = await page.getByTestId('search-results').locator('[role="option"]').count();
    if (resultCount > 1) {
      await page.keyboard.press('ArrowDown');
      await expect(page.locator('[id="search-result-1"][aria-selected="true"]')).toBeVisible();
    }
  });
});
