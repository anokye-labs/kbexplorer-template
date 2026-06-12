import { test, expect, type Page } from '@playwright/test';
import { openIssue } from '../../twins/gitea/actors/open-issue.mjs';

/**
 * Scenario: an actor opens an issue in the live Gitea twin and the app reflects
 * it as a new work node. Also exercises the real cache/refresh contract — a
 * reload inside the cache TTL keeps serving the stale list; clearing the cache
 * (what a forced refresh does) surfaces the new node.
 */

async function clearCacheAndReload(page: Page) {
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
}

test.describe('Gitea DTU — issue lifecycle', () => {
  test('a newly opened issue appears as a node after a cache-fresh load', async ({ page }) => {
    const title = `DTU appears ${Date.now()}`;
    const issue = await openIssue({ title, labels: ['enhancement'] });
    expect(issue.number).toBeGreaterThan(0);

    // Fresh context → empty cache → first load fetches live, including the new issue.
    await page.goto('/#/overview', { waitUntil: 'networkidle', timeout: 60000 });
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 15000 });
  });

  test('cached list hides the new issue until a refresh clears the cache', async ({ page }) => {
    // 1) Warm the cache with the current issue list.
    await page.goto('/#/overview', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1500);

    // 2) Actor opens a new issue AFTER the cache is warm.
    const title = `DTU cached ${Date.now()}`;
    await openIssue({ title, labels: ['bug'] });

    // 3) A plain reload stays within the TTL → cached list, new issue absent.
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await expect(page.getByText(title)).toHaveCount(0);

    // 4) Clearing the cache (a forced refresh) surfaces the new node.
    await clearCacheAndReload(page);
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 15000 });
  });
});
