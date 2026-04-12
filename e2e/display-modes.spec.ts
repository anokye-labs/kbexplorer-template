import { test, expect } from '@playwright/test';

test.describe('Display Modes', () => {
  test('code display renders pre/code block', async ({ page }) => {
    // eslint-config is a nodemap node with display: 'code'
    await page.goto('/#/node/eslint-config', { timeout: 60000 });
    await page.waitForTimeout(3000);
    const codeBlock = page.locator('.kb-code-display').first();
    await expect(codeBlock).toBeVisible({ timeout: 10000 });
  });

  test('tree display renders file listing', async ({ page }) => {
    // styles-directory is a nodemap node with display: 'tree'
    await page.goto('/#/node/styles-directory', { timeout: 60000 });
    await page.waitForTimeout(3000);
    // Should show file names from src/styles/
    await expect(page.getByText(/\.css/).first()).toBeVisible({ timeout: 10000 });
  });

  test('prose display renders markdown HTML', async ({ page }) => {
    await page.goto('/#/node/overview', { timeout: 60000 });
    await page.waitForTimeout(3000);
    await expect(page.locator('.kb-prose h1, .kb-prose h2').first()).toBeVisible({ timeout: 10000 });
  });
});
