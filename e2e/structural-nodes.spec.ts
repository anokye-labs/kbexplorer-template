import { test, expect } from '@playwright/test';

// F3 — Agile discovery & repo-structural nodes (#150 → #166/#167/#168).
// Exercises, on the real local cached-data flow (VITE_KB_LOCAL build):
//  • #167 — a .github workflow is a first-class node linked to the repository
//    node via a `structural` relation (surfaced as the "Related structure" link).
//  • #168 — the bespoke WorkflowView + the generic structured viewer fallback.
// Safe-by-default: structural discovery is a no-op when .github is absent, so
// these only assert behaviour that exists because this repo HAS a .github dir.

const ART = 'e2e/artifacts';

test.describe('Structural nodes (.github discovery → repository)', () => {
  test('workflow node renders WorkflowView and links to the repository node', async ({ page }) => {
    await page.goto('/#/node/gh-workflow-github-pages-yml', { timeout: 60000 });
    await page.waitForTimeout(3000);

    // #168 — bespoke workflow viewer
    const view = page.locator('.kb-workflow-view');
    await expect(view).toBeVisible({ timeout: 10000 });
    await expect(view).toContainText('Deploy to GitHub Pages');
    await expect(view.locator('.kb-workflow-triggers')).toContainText('Triggers');
    await expect(view.locator('.kb-workflow-jobs')).toContainText('Jobs');

    // structured SourceBadge for the workflow source
    await expect(page.getByText(/Workflow · github-pages\.yml/i).first()).toBeVisible({ timeout: 10000 });

    // #167 — the structural edge to the repository node, made visible & navigable
    const relations = page.getByTestId('structural-relations');
    await expect(relations).toBeVisible({ timeout: 10000 });
    const repoLink = relations.locator('a[href="#/node/repo-meta"]');
    await expect(repoLink).toBeVisible();
    await expect(repoLink).toContainText(/configures the repository/i);

    await page.screenshot({ path: `${ART}/workflow-node.png`, fullPage: true });

    // Follow the structural edge to the repository node.
    await repoLink.click();
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/#\/node\/repo-meta$/);
  });

  test('dependabot config falls back to the generic structured viewer', async ({ page }) => {
    await page.goto('/#/node/gh-dependabot-dependabot-yml', { timeout: 60000 });
    await page.waitForTimeout(3000);

    const view = page.locator('.kb-structured-view');
    await expect(view).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Entity · /i).first()).toBeVisible({ timeout: 10000 });

    // links back to the repository node too
    const repoLink = page.getByTestId('structural-relations').locator('a[href="#/node/repo-meta"]');
    await expect(repoLink).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: `${ART}/dependabot-node.png`, fullPage: true });
  });
});
