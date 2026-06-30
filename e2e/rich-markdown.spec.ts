import { test, expect } from '@playwright/test';

/**
 * Rich-Markdown rendering (Wave 0b — #427).
 *
 * The sample document is injected client-side via the `?demo=richmd` seam, so
 * this runs against the standard preview build + GitHub twin without any
 * provider dependency. It asserts the acceptance criteria end-to-end in a
 * single page load (one content fetch — friendlier to the twin's rate limit):
 *  - frontmatter renders in the structured view;
 *  - a live Mermaid block renders to SVG;
 *  - the `dot` and `canvas` blocks render via the pre-built-SVG fallback;
 *  - no SVG-backed block is left as a raw code dump.
 */
const DOC_URL = '/#/node/demo-richmd-doc?demo=richmd';

test('rich-Markdown document renders frontmatter, live Mermaid and SVG-fallback blocks (#427)', async ({
  page,
}) => {
  await page.goto(DOC_URL, { timeout: 60000 });

  // 1. Frontmatter facts in the structured view.
  const facts = page.getByTestId('richmd-frontmatter');
  await expect(facts).toBeVisible({ timeout: 20000 });
  await expect(facts.locator('.kb-structured-view')).toBeVisible();
  await expect(facts).toContainText('Release Pipeline');
  await expect(facts).toContainText('Team Atlas');

  // 2. Live Mermaid block → SVG.
  const mermaid = page.locator('.kb-diagram[data-diagram-language="mermaid"]').first();
  await expect(mermaid).toBeVisible({ timeout: 20000 });
  await expect(mermaid.locator('svg')).toBeVisible();

  // 3. dot + canvas blocks render via the pre-built-SVG fallback — as an inert
  //    <img> data URL (untrusted SVG is never inlined into the live DOM).
  for (const kind of ['dot', 'canvas']) {
    const figure = page.locator(
      `figure[data-block-renderer="svg-fallback"][data-diagram-language="${kind}"]`,
    );
    await expect(figure).toBeVisible({ timeout: 20000 });
    const img = figure.locator('img.kb-diagram-svg');
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute('src', /^data:image\/svg\+xml/);
    // the SVG is loaded as an image, never parsed into the DOM
    await expect(figure.locator('svg')).toHaveCount(0);
  }

  // 4. No SVG-backed block is left as visible raw code (source tucked into a
  //    collapsed <details>, replaced by the SVG figure).
  for (const kind of ['dot', 'canvas', 'ics']) {
    await expect(page.locator(`code.language-${kind}`)).toBeHidden();
  }
});
