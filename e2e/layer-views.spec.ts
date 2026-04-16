import { test, expect } from '@playwright/test';

test.describe('Graph Views', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/node/readme', { timeout: 60000 });
    await page.evaluate(() => localStorage.setItem('kbe-hud-dock', 'left'));
    await page.reload({ timeout: 60000 });
    await page.waitForTimeout(5000);
  });

  test('Docs view filters to content nodes', async ({ page }) => {
    await page.getByRole('button', { name: 'Docs' }).click();
    await page.waitForTimeout(3000);
    await expect(page.locator('.kb-prose')).toBeVisible();
  });

  test('Code view shows code-related nodes', async ({ page }) => {
    await page.getByRole('button', { name: 'Code' }).click();
    await page.waitForTimeout(3000);
    await expect(page.locator('.kb-prose')).toBeVisible();
  });

  test('Work view shows issues', async ({ page }) => {
    await page.getByRole('button', { name: 'Work' }).click();
    await page.waitForTimeout(3000);
    await expect(page.locator('.kb-prose')).toBeVisible();
  });

  test('External view shows Wikipedia nodes + neighbors', async ({ page }) => {
    await page.getByRole('button', { name: 'External' }).click();
    await page.waitForTimeout(3000);
    await expect(page.locator('.kb-prose')).toBeVisible();
  });

  test('All view restores full graph', async ({ page }) => {
    await page.getByRole('button', { name: 'Docs' }).click();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'All' }).click();
    await page.waitForTimeout(3000);
    await expect(page.locator('.kb-prose')).toBeVisible();
  });
});
