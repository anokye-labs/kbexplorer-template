import { test, expect, type Page, request as pwRequest } from '@playwright/test';
import { editSource } from '../../twins/gitea/actors/edit-source.mjs';
import { cutRelease } from '../../twins/gitea/actors/cut-release.mjs';
import {
  coords,
  getContents,
  mergePull,
} from '../../twins/gitea/gitea-client.mjs';

/**
 * Work-graph DTU scenarios: team / workstream / release mutations reflected on
 * refresh (issue #256).
 *
 * ## Substrate
 *
 * The Gitea twin serves three distinct surfaces the app reads:
 *
 *   1. `contents` / `git/trees` — raw YAML files (team, workstream descriptors).
 *      The adapter proxies these byte-for-byte; any merged edit appears on the
 *      next cache-fresh load.
 *
 *   2. `releases` — the `fetchReleases()` path, now proxied by the adapter
 *      (see `adapter.mjs` `normalizeRelease`). `cutRelease()` creates a real
 *      Gitea release; the app renders it as a release node (cluster `releases`).
 *
 *   3. Content-model semantic nodes (cluster `team`, `workstream`) are derived by
 *      `ContentModelProvider`, which is registered as a **safe no-op**
 *      (`new ContentModelProvider(null)`) in `loadRemoteKnowledgeBase()` — the
 *      remote content-model fetch path is not yet wired. This means team /
 *      workstream nodes from `content-model/teams/*.yaml` and
 *      `content-model/workstreams/*.yaml` do NOT appear in the live app as
 *      semantic cluster nodes.
 *
 * ## Gap (honest)
 *
 * Semantic team/workstream nodes are not rendered in remote mode until the
 * content-model fetch path lands in `loadRemoteKnowledgeBase` (the
 * `ContentModelProvider(null)` registration becomes live). The specs below
 * validate the **complete live path** for releases and the **proxy layer** for
 * team/workstream edits (updated YAML on `main` is reflected in the adapter's
 * `contents` response). The semantic graph assertion for teams/workstreams is
 * marked `.fixme` with a comment explaining the gap so it is visible to CI and
 * can be unfixme'd when the feature lands.
 */

const TWIN_PORT = Number(process.env.DTU_TWIN_PORT ?? 3557);
const TWIN_BASE = `http://localhost:${TWIN_PORT}`;

async function freshLoad(page: Page, hash: string) {
  await page.goto(`/#${hash}`, { waitUntil: 'networkidle', timeout: 60_000 });
}

async function clearCacheAndReload(page: Page) {
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
}

// ────────────────────────────────────────────────────────────────────────────
// Release scenarios
// ────────────────────────────────────────────────────────────────────────────

test.describe('Gitea DTU — release mutations', () => {
  test('a new release appears as a release node on a cache-fresh load', async ({ page }) => {
    const tag = `dtu-v9-${Date.now()}`;
    const releaseName = `DTU Release ${tag}`;

    const rel = await cutRelease({ tag, name: releaseName });
    expect(rel.tag).toBe(tag);
    expect(rel.prerelease).toBe(false);

    // Fresh context — empty localStorage — fetches live releases.
    await freshLoad(page, '/overview');

    // The release node should be visible by its display name.
    await expect(page.getByText(releaseName).first()).toBeVisible({ timeout: 15_000 });
  });

  test('a pre-release is reflected as a separate release node', async ({ page }) => {
    const tag = `dtu-pre-${Date.now()}`;
    const relName = `DTU Pre-Release ${tag}`;

    const rel = await cutRelease({ tag, name: relName, prerelease: true });
    expect(rel.prerelease).toBe(true);

    await freshLoad(page, '/overview');

    await expect(page.getByText(relName).first()).toBeVisible({ timeout: 15_000 });
  });

  test('adapter release endpoint: normalizes Gitea release to GitHub shape', async () => {
    /**
     * Request-level check: the adapter's /releases route returns a response with
     * the GitHub-shaped fields the app's `fetchReleases()` reads (`tag_name`,
     * `name`, `published_at`, `prerelease`). Validates `normalizeRelease`.
     */
    const { owner, repo } = coords();
    const tag = `dtu-shape-${Date.now()}`;
    const relName = `DTU Shape Check ${tag}`;

    await cutRelease({ tag, name: relName });

    const ctx = await pwRequest.newContext({ baseURL: TWIN_BASE });
    try {
      const releasesPath = `/repos/${owner}/${repo}/releases?per_page=30`;
      const res = await ctx.get(releasesPath);
      expect(res.status()).toBe(200);

      const data = await res.json() as Array<Record<string, unknown>>;
      expect(Array.isArray(data)).toBe(true);

      const mine = data.find((r) => r['tag_name'] === tag);
      expect(mine).toBeDefined();
      // GitHub-shape fields the app reads:
      expect(typeof mine!['tag_name']).toBe('string');
      expect(typeof mine!['name']).toBe('string');
      expect(typeof mine!['published_at']).toBe('string');
      expect(typeof mine!['prerelease']).toBe('boolean');
      expect(typeof mine!['html_url']).toBe('string');

      // ETag header present (enables 304 caching in the app).
      expect(res.headers()['etag']).toBeTruthy();
    } finally {
      await ctx.dispose();
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Team YAML mutation scenarios
// ────────────────────────────────────────────────────────────────────────────

test.describe('Gitea DTU — team YAML mutations', () => {
  test(
    'editing a team YAML and merging updates the file on main via the adapter contents route',
    async ({ page }) => {
      /**
       * Validates the full proxy layer: actor edits teams/graph-platform.yaml,
       * merges, and the updated YAML is served by the adapter's `contents` route
       * (same path the app uses for `fetchFile`). The file-tree directory node for
       * `content-model/teams/` also refreshes its ETag.
       *
       * Semantic team cluster node assertion: see `.fixme` test below.
       */
      const { owner, repo, branch } = coords();
      const marker = `DTU-TEAM-${Date.now()}`;

      // 1) Actor edits teams/graph-platform.yaml — appends a marker comment.
      const { pr: prNumber, path: editPath } = await editSource({
        path: 'content-model/teams/graph-platform.yaml',
        marker,
        title: `DTU team edit ${marker}`,
      });
      expect(prNumber).toBeGreaterThan(0);

      // 2) Merge the PR to advance main.
      const merge = await mergePull(owner, repo, prNumber, { style: 'merge' });
      expect(merge.merged).toBe(true);

      // 3) Verify the updated YAML is on main.
      const onMain = await getContents(owner, repo, editPath, branch);
      const mainText = Buffer.from(onMain.content, 'base64').toString('utf8');
      expect(mainText).toContain(marker);

      // 4) Adapter's `contents` route returns the updated file with a fresh ETag.
      const ctx = await pwRequest.newContext({ baseURL: TWIN_BASE });
      try {
        const contentsPath = `/repos/${owner}/${repo}/contents/${editPath}?ref=${branch}`;
        const res = await ctx.get(contentsPath);
        expect(res.status()).toBe(200);

        const data = await res.json() as Record<string, unknown>;
        expect(data['encoding']).toBe('base64');
        const decoded = Buffer.from(data['content'] as string, 'base64').toString('utf8');
        expect(decoded).toContain(marker);
      } finally {
        await ctx.dispose();
      }

      // 5) App: after clearing the cache, the file tree reflects the updated tree.
      //    We verify the app loads without error (regression guard) and that the
      //    content-model/teams directory node is still present.
      await clearCacheAndReload(page);
      await freshLoad(page, '/overview');
      // The directory node title "content-model/teams/" appears in the file-tree region.
      await expect(page.getByText('content-model/teams/').first()).toBeVisible({ timeout: 15_000 });
    },
  );

  /**
   * GAP: semantic team cluster node does not appear in remote mode.
   *
   * `ContentModelProvider` is registered as `new ContentModelProvider(null)` in
   * `loadRemoteKnowledgeBase()` (src/engine/remote-loader.ts:220) — the content-
   * model fetch path is not yet wired for remote/live operation. Until that
   * feature lands, `team` cluster nodes from `content-model/teams/*.yaml` are
   * absent from the live app, so we cannot assert `page.getByText('Graph Platform')`.
   *
   * Unfix this test when the remote content-model fetch path is wired.
   */
  test.fixme(
    'team name change is reflected as a renamed team node in the graph (remote content-model gap)',
    async ({ page }) => {
      const { owner, repo, branch } = coords();
      const newName = `Graph Platform DTU ${Date.now()}`;
      const marker = newName;

      const { pr: prNumber } = await editSource({
        path: 'content-model/teams/graph-platform.yaml',
        set: { name: `"${newName}"` },
        title: `DTU team rename ${Date.now()}`,
      });
      const merge = await mergePull(owner, repo, prNumber, { style: 'merge' });
      expect(merge.merged).toBe(true);

      // Confirm the twin's main has the new name.
      const onMain = await getContents(owner, repo, 'content-model/teams/graph-platform.yaml', branch);
      const mainText = Buffer.from(onMain.content, 'base64').toString('utf8');
      expect(mainText).toContain(marker);

      // Semantic assertion: team node should appear in the overview.
      // (Currently fails because ContentModelProvider is a no-op in remote mode.)
      await clearCacheAndReload(page);
      await freshLoad(page, '/overview');
      await expect(page.getByText(newName).first()).toBeVisible({ timeout: 15_000 });
    },
  );
});

// ────────────────────────────────────────────────────────────────────────────
// Workstream YAML mutation scenarios
// ────────────────────────────────────────────────────────────────────────────

test.describe('Gitea DTU — workstream YAML mutations', () => {
  test(
    'editing a workstream YAML and merging updates the file on main via the adapter',
    async ({ page }) => {
      /**
       * Same proxy-layer check as the team scenario, for workstreams.
       * Merges an edit to workstreams/kb-explorer.yaml and confirms the adapter
       * serves the updated content via the `contents` route.
       */
      const { owner, repo, branch } = coords();
      const marker = `DTU-WS-${Date.now()}`;

      const { pr: prNumber, path: editPath } = await editSource({
        path: 'content-model/workstreams/kb-explorer.yaml',
        marker,
        title: `DTU workstream edit ${marker}`,
      });
      expect(prNumber).toBeGreaterThan(0);

      const merge = await mergePull(owner, repo, prNumber, { style: 'merge' });
      expect(merge.merged).toBe(true);

      // Confirm file updated on main.
      const onMain = await getContents(owner, repo, editPath, branch);
      const mainText = Buffer.from(onMain.content, 'base64').toString('utf8');
      expect(mainText).toContain(marker);

      // Adapter contents route reflects the change.
      const ctx = await pwRequest.newContext({ baseURL: TWIN_BASE });
      try {
        const contentsPath = `/repos/${owner}/${repo}/contents/${editPath}?ref=${branch}`;
        const res = await ctx.get(contentsPath);
        expect(res.status()).toBe(200);
        const data = await res.json() as Record<string, unknown>;
        const decoded = Buffer.from(data['content'] as string, 'base64').toString('utf8');
        expect(decoded).toContain(marker);
      } finally {
        await ctx.dispose();
      }

      // App-level: directory node still visible after cache clear.
      await clearCacheAndReload(page);
      await freshLoad(page, '/overview');
      await expect(page.getByText('content-model/workstreams/').first()).toBeVisible({ timeout: 15_000 });
    },
  );

  /**
   * GAP: semantic workstream cluster node not present in remote mode.
   * Same root cause as the team gap above — ContentModelProvider(null) no-op.
   *
   * Unfix when the remote content-model fetch path lands.
   */
  test.fixme(
    'workstream description edit is reflected as an updated workstream node (remote content-model gap)',
    async ({ page }) => {
      const { owner, repo, branch } = coords();
      const newDesc = `DTU workstream updated ${Date.now()}`;

      const { pr: prNumber } = await editSource({
        path: 'content-model/workstreams/kb-explorer.yaml',
        set: { description: `"${newDesc}"` },
        title: `DTU workstream desc ${Date.now()}`,
      });
      const merge = await mergePull(owner, repo, prNumber, { style: 'merge' });
      expect(merge.merged).toBe(true);

      const onMain = await getContents(owner, repo, 'content-model/workstreams/kb-explorer.yaml', branch);
      const mainText = Buffer.from(onMain.content, 'base64').toString('utf8');
      expect(mainText).toContain(newDesc);

      // Semantic assertion: workstream node visible with updated description.
      await clearCacheAndReload(page);
      await freshLoad(page, '/overview');
      await expect(page.getByText(newDesc).first()).toBeVisible({ timeout: 15_000 });
    },
  );
});
