import { test, expect } from '@playwright/test';

test.describe('Cluster Collapse', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/node/readme', { timeout: 60000 });
    await page.evaluate(() => {
      localStorage.setItem('kbe-hud-dock', 'left');
      localStorage.setItem('kbe-collapsed-clusters', '[]');
    });
    await page.reload({ timeout: 60000 });
    await page.waitForTimeout(5000);
  });

  test('clicking cluster legend collapses it', async ({ page }) => {
    // Match cluster titles like "Collapse Engine" (not bare "Collapse" sidebar button)
    const cluster = page.getByTitle(/^Collapse \w/).first();
    await expect(cluster).toBeVisible();
    await cluster.click();
    await page.waitForTimeout(2000);
    // Should now show "Expand <name>" title
    await expect(page.getByTitle(/^Expand \w/).first()).toBeVisible();
  });

  test('collapsed cluster shows strikethrough', async ({ page }) => {
    const cluster = page.getByTitle(/^Collapse \w/).first();
    await cluster.click();
    await page.waitForTimeout(1000);
    // The text element (last span child, after the color dot) should have line-through
    const expandItem = page.getByTitle(/^Expand \w/).first();
    const hasLineThrough = await expandItem.evaluate(el => {
      for (const span of el.querySelectorAll('span')) {
        if (span.textContent && getComputedStyle(span).textDecorationLine === 'line-through') {
          return true;
        }
      }
      return false;
    });
    expect(hasLineThrough).toBe(true);
  });

  test('expanding cluster restores nodes', async ({ page }) => {
    const cluster = page.getByTitle(/^Collapse \w/).first();
    await cluster.click();
    await page.waitForTimeout(2000);
    // Expand it back
    const expandBtn = page.getByTitle(/^Expand \w/).first();
    await expandBtn.click();
    await page.waitForTimeout(2000);
    // Should show Collapse again
    await expect(page.getByTitle(/^Collapse \w/).first()).toBeVisible();
  });
});
