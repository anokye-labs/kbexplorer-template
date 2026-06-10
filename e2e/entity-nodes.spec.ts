import { test, expect } from '@playwright/test';

// Exercises the open node-type foundation end-to-end via the off-by-default
// demo-entities seam (?demo=entities): the entity viewer registry (T1.4),
// ReadingView display:'entity' + structured SourceBadge (T1.6/#158), and the
// stale-cache clean render after the CACHE_VERSION bump (#159).

test.describe('Entity nodes (open node-type foundation)', () => {
  test('person entity resolves the bespoke PersonView', async ({ page }) => {
    await page.goto('/?demo=entities#/node/demo-person-ada', { timeout: 60000 });
    await page.waitForTimeout(3000);

    const view = page.locator('.kb-person-view');
    await expect(view).toBeVisible({ timeout: 10000 });
    await expect(view).toContainText('Ada Okonkwo');
    await expect(view).toContainText('Engineering Lead');
    await expect(view.locator('a[href^="mailto:"]')).toHaveAttribute('href', 'mailto:ada@example.com');

    // SourceBadge handles the structured source
    await expect(page.getByText(/Entity · Person/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('team entity falls back to the generic structured viewer', async ({ page }) => {
    await page.goto('/?demo=entities#/node/demo-team-atlas', { timeout: 60000 });
    await page.waitForTimeout(3000);

    const view = page.locator('.kb-structured-view');
    await expect(view).toBeVisible({ timeout: 10000 });
    // humanized keys + values from the data bag
    await expect(view).toContainText('Mission');
    await expect(view).toContainText('Owns the knowledge-graph engine');
    // JSON-LD @id surfaced in the header
    await expect(view).toContainText('kg://team/demo-team-atlas');
  });

  test('renders cleanly when stale (older-version) cache is present', async ({ page }) => {
    // Seed a previous-version cache entry to exercise the real cached-data flow.
    await page.addInitScript(() => {
      try {
        localStorage.setItem('kbe:version', '12');
        localStorage.setItem('kbe:stale-junk', JSON.stringify({ shape: 'old', t: 0 }));
      } catch { /* ignore */ }
    });

    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('@griffel')) errors.push(msg.text());
    });

    await page.goto('/#/node/readme', { timeout: 60000 });
    await expect(page.locator('.kb-prose')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.kb-prose')).toContainText('kbexplorer');

    await page.waitForTimeout(1500);
    const appErrors = errors.filter(e => !e.includes('403') && !e.includes('rate limit'));
    expect(appErrors).toHaveLength(0);
  });
});
