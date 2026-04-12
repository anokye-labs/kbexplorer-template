import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('app loads with correct title', async ({ page }) => {
    await page.goto('/', { timeout: 60000 });
    await expect(page).toHaveTitle(/kbexplorer/);
  });

  test('README node renders content', async ({ page }) => {
    await page.goto('/#/node/readme', { timeout: 60000 });
    await expect(page.locator('.kb-prose')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.kb-prose')).toContainText('kbexplorer');
  });

  test('overview node renders content', async ({ page }) => {
    await page.goto('/#/node/overview', { timeout: 60000 });
    await expect(page.locator('.kb-prose')).toBeVisible({ timeout: 10000 });
  });

  test('no unexpected console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('@griffel')) {
        errors.push(msg.text());
      }
    });
    await page.goto('/#/node/readme', { timeout: 60000 });
    await page.waitForTimeout(3000);
    const appErrors = errors.filter(e => !e.includes('403') && !e.includes('rate limit'));
    expect(appErrors).toHaveLength(0);
  });
});
