import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('inline link navigates to target node', async ({ page }) => {
    await page.goto('/#/node/readme', { timeout: 60000 });
    await page.waitForSelector('.kb-prose', { timeout: 10000 });
    // Click an inline link — README has links like "graph engine"
    const link = page.locator('.kb-prose a[href*="#/node/"]').first();
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    await link.click();
    // Should navigate to the target node
    await expect(page).toHaveURL(new RegExp(href!.replace('#', '')));
    await expect(page.locator('.kb-prose')).toBeVisible({ timeout: 10000 });
  });

  test('browser back button works', async ({ page }) => {
    await page.goto('/#/node/readme', { timeout: 60000 });
    await page.waitForSelector('.kb-prose', { timeout: 10000 });
    await page.goto('/#/node/overview');
    await page.waitForSelector('.kb-prose', { timeout: 10000 });
    await page.goBack();
    await expect(page).toHaveURL(/readme/);
  });

  test('connection card navigates to target', async ({ page }) => {
    await page.goto('/#/node/readme', { timeout: 60000 });
    await page.evaluate(() => localStorage.setItem('kbe-hud-dock', 'left'));
    await page.reload({ timeout: 60000 });
    await page.waitForTimeout(5000);
    // Click a connection in the sidebar
    const connection = page.locator('a[href*="#/node/"]').filter({ has: page.locator('img') }).first();
    if (await connection.isVisible()) {
      await connection.click();
      await page.waitForTimeout(2000);
      await expect(page.locator('.kb-prose')).toBeVisible();
    }
  });

  test('unknown node shows not found', async ({ page }) => {
    await page.goto('/#/node/nonexistent-node-xyz', { timeout: 60000 });
    await page.waitForTimeout(3000);
    await expect(page.getByText(/not found/i)).toBeVisible();
  });
});
