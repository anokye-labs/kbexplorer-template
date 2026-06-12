import { test, expect, type Page } from '@playwright/test';
import { editSource } from '../../twins/gitea/actors/edit-source.mjs';
import {
  coords,
  ensureBranch,
  getContents,
  putFile,
  ensurePull,
  mergePull,
  gitea,
} from '../../twins/gitea/gitea-client.mjs';

/**
 * Scenarios that exercise the PR side of the multi-agent loop:
 *  - an actor opens a PR → the app shows a Pull Request node;
 *  - merging a PR advances `main` → the app reflects the new file content
 *    after a cache-fresh refresh ("refreshes eventually reflect updates to main").
 */

async function freshLoad(page: Page, hash: string) {
  await page.goto(`/#${hash}`, { waitUntil: 'networkidle', timeout: 60000 });
}

test.describe('Gitea DTU — pull requests & merges', () => {
  test('an actor-opened PR appears as a Pull Request node', async ({ page }) => {
    const prTitle = `DTU PR node ${Date.now()}`;
    const res = await editSource({
      path: 'content-model/people/ben.yaml',
      set: { title: `Staff Engineer ${Date.now()}` },
      title: prTitle,
    });
    expect(res.pr).toBeGreaterThan(0);

    await freshLoad(page, '/overview');
    await expect(page.getByText(prTitle).first()).toBeVisible({ timeout: 15000 });
  });

  test('merging a README edit updates the README node on main after refresh', async ({ page }) => {
    const { owner, repo, branch } = coords();
    const marker = `DTU-MERGE-MARKER-${Date.now()}`;
    const prBranch = `dtu/readme-${Date.now()}`;

    await gitea('DELETE', `/repos/${owner}/${repo}/branches/${prBranch}`).catch(() => {});
    await ensureBranch(owner, repo, prBranch, branch);

    const current = await getContents(owner, repo, 'README.md', prBranch);
    const base = current?.content
      ? Buffer.from(current.content, 'base64').toString('utf8')
      : '# README\n';
    const updated = `${base.replace(/\s*$/, '')}\n\n${marker}\n`;

    await putFile(owner, repo, 'README.md', {
      content: updated,
      message: `DTU: README marker ${marker}`,
      branch: prBranch,
    });

    const { pull } = await ensurePull(owner, repo, {
      title: `DTU README merge ${marker}`,
      head: prBranch,
      base: branch,
      body: 'Validates main-update reflection after merge.',
    });

    const merge = await mergePull(owner, repo, pull.number, { style: 'merge' });
    expect(merge.merged).toBe(true);

    // Confirm the twin's main really advanced before asserting in the app.
    const onMain = await getContents(owner, repo, 'README.md', branch);
    const mainText = Buffer.from(onMain.content, 'base64').toString('utf8');
    expect(mainText).toContain(marker);

    // Fresh context → empty cache → README node renders the merged content.
    await freshLoad(page, '/node/readme');
    await expect(page.getByText(marker).first()).toBeVisible({ timeout: 15000 });
  });
});
