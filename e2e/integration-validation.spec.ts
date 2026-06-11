import { test, expect } from '@playwright/test';

/**
 * F4 / T4.1 — Real-content integration E2E (#169).
 *
 * Validates the whole new-node-type system end-to-end on the REAL local cached
 * data flow (the `VITE_KB_LOCAL=true` build served by `vite preview`), exercised
 * as a returning user would hit it: the demo-entities seam is enabled via the
 * PERSISTED `localStorage['kbe-demo-entities']` setting (not a clean-state
 * `?demo=` URL shortcut), and each node is reached after the graph has already
 * been loaded + cached by a prior navigation in the same session (cache present,
 * in-session switching) — per the repo's "test the actual cached flow" rule.
 *
 * Proves:
 *   (a) a Person node renders through its bespoke PersonView (F1/F2 viewer registry)
 *   (b) a Squad  node renders through its bespoke SquadView   (F2 / #164)
 *   (c) a .github Workflow node renders through WorkflowView AND shows its
 *       `structural` edge to the `repo-meta` repository node (F3 / #167), navigable.
 *
 * A screenshot of each is captured to e2e/artifacts/ as evidence.
 */

const ART = 'e2e/artifacts';

test.describe('F4 integration validation (real cached-data flow)', () => {
  test.beforeEach(async ({ page }) => {
    // Persisted setting: enable the demo-entities seam the way a returning user
    // would have it set — via localStorage, applied on every load in this context.
    await page.addInitScript(() => {
      try {
        localStorage.setItem('kbe-demo-entities', '1');
      } catch {
        /* localStorage may be unavailable; the seam also honors ?demo=entities */
      }
    });

    // Warm the cache: load the hub once so the graph is built + cached in
    // localStorage. Subsequent navigations exercise the cached-data path.
    await page.goto('/#/node/readme', { timeout: 60000 });
    await expect(page.locator('.kb-prose').first()).toBeVisible({ timeout: 20000 });
  });

  test('(a) Person node renders through the bespoke PersonView', async ({ page }) => {
    await page.goto('/#/node/demo-person-ada', { timeout: 60000 });

    const view = page.locator('.kb-person-view');
    await expect(view).toBeVisible({ timeout: 15000 });
    await expect(view).toContainText('Ada Okonkwo');
    await expect(view).toContainText('Engineering Lead');
    await expect(view.locator('a[href^="mailto:"]')).toHaveAttribute('href', 'mailto:ada@example.com');

    // Structured SourceBadge classifies the entity source.
    await expect(page.getByText(/Entity · Person/i).first()).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: `${ART}/f4-person-node.png`, fullPage: true });
  });

  test('(b) Squad node renders through the bespoke SquadView', async ({ page }) => {
    await page.goto('/#/node/demo-squad-orbit', { timeout: 60000 });

    const view = page.locator('.kb-squad-view');
    await expect(view).toBeVisible({ timeout: 15000 });
    await expect(view).toContainText('Squad Orbit');
    await expect(view).toContainText('Delivers the discovery & search experience');
    // DRI handle + members surfaced by the bespoke viewer.
    await expect(view).toContainText('@ada');
    await expect(view).toContainText('Ada Okonkwo');
    await expect(view).toContainText('Ben Carter');

    // Structured SourceBadge classifies the squad entity source.
    await expect(page.getByText(/Entity · Squad/i).first()).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: `${ART}/f4-squad-node.png`, fullPage: true });
  });

  test('(c) Workflow node renders via WorkflowView and links to repo-meta', async ({ page }) => {
    await page.goto('/#/node/gh-workflow-github-pages-yml', { timeout: 60000 });

    // Bespoke workflow viewer.
    const view = page.locator('.kb-workflow-view');
    await expect(view).toBeVisible({ timeout: 15000 });
    await expect(view).toContainText('Deploy to GitHub Pages');
    await expect(view.locator('.kb-workflow-triggers')).toContainText('Triggers');
    await expect(view.locator('.kb-workflow-jobs')).toContainText('Jobs');

    await expect(page.getByText(/Workflow · github-pages\.yml/i).first()).toBeVisible({ timeout: 10000 });

    // Structural edge to the repository (repo-meta) node — visible + navigable.
    const relations = page.getByTestId('structural-relations');
    await expect(relations).toBeVisible({ timeout: 10000 });
    const repoLink = relations.locator('a[href="#/node/repo-meta"]');
    await expect(repoLink).toBeVisible();
    await expect(repoLink).toContainText(/configures the repository/i);

    await page.screenshot({ path: `${ART}/f4-workflow-structural-edge.png`, fullPage: true });

    // Follow the structural edge to the repository node.
    await repoLink.click();
    await expect(page).toHaveURL(/#\/node\/repo-meta$/);
  });
});
