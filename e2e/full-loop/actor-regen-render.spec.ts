import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Full-loop deployment scenario: actor → twin → CLI regen → app render → verify.
 *
 * What this proves
 * ───────────────
 * The mutation committed by an actor to a GitHub twin is faithfully reflected
 * in the app after the CLI regenerates the manifest. This is the end-to-end
 * shape of a real deployment:
 *
 *   actor mutates twin
 *     → CLI generates manifest from twin  (KBEXPLORER_GH_API_BASE)
 *     → app serves in local mode          (VITE_KB_LOCAL=true, pre-built manifest)
 *     → browser renders the new node
 *
 * Substrate (this run): the in-process mutable GitHub twin in global-setup.mts
 * (startMutableTwin). The "actor mutation" injects an item into that twin's
 * in-memory state before the CLI regen — architecturally identical to the Gitea
 * actor path but backed by canned fixtures rather than Podman+Gitea.
 *
 * Deferred gap
 * ────────────
 * The live-Gitea half (Podman bootstrap → Gitea actor → Gitea adapter →
 * KBEXPLORER_GH_API_BASE pointing at the adapter) is not wired here.
 * To close the gap:
 *   1. Flip FULL_LOOP_SUBSTRATE=gitea in your env.
 *   2. The globalSetup needs dtu:up + dtu:seed + the Gitea adapter as the twin.
 *   3. Replace injectIssue() with openIssue() from twins/gitea/actors/open-issue.mjs.
 * The assertions below are substrate-agnostic — they will pass unchanged
 * against the Gitea half once it is wired.
 *
 * Holdout rule: all assertions live here, never inside the twin or globalSetup.
 */

const REPO_ROOT = resolve(__dirname, '..', '..');
const STATE_FILE = resolve(REPO_ROOT, '.dtu', 'full-loop-state.json');

function readSentinelTitle(): string {
  const raw = readFileSync(STATE_FILE, 'utf-8');
  const state = JSON.parse(raw) as { sentinelTitle: string; substrate: string };
  console.log(`[full-loop:spec] Running against substrate: ${state.substrate}`);
  return state.sentinelTitle;
}

test.describe('Full-loop: actor → twin → CLI regen → app render → verify', () => {
  let sentinelTitle: string;

  test.beforeAll(() => {
    sentinelTitle = readSentinelTitle();
  });

  test('actor-mutated issue appears as a node in the rendered graph', async ({ page }) => {
    // The app is in local mode: it reads from the pre-generated manifest which
    // includes the sentinel issue injected by the actor in globalSetup.
    await page.goto('/#/overview', { waitUntil: 'networkidle', timeout: 60_000 });

    // The sentinel issue must appear somewhere on the page as a visible node.
    // We do not constrain how the app renders it (title, cluster, view) — only
    // that the text from the mutation is present.
    await expect(page.getByText(sentinelTitle).first()).toBeVisible({ timeout: 20_000 });
  });

  test('sentinel issue node renders in the overview with the correct title', async ({ page }) => {
    // Navigate to the overview and assert the actor-injected node is rendered.
    await page.goto('/#/overview', { waitUntil: 'networkidle', timeout: 60_000 });
    const nodeEl = page.getByText(sentinelTitle).first();
    await expect(nodeEl).toBeVisible({ timeout: 20_000 });
    // The title text must be an exact sub-string match — not partial / truncated
    // to the point of ambiguity.
    const text = await nodeEl.textContent();
    expect(text).toContain(sentinelTitle);
  });

  test('manifest generatedAt is recent (CLI actually ran during this test session)', async () => {
    // Confirm the manifest file is fresh — i.e. the CLI generated it during the
    // globalSetup of this session and not from a stale prior run.
    const manifestPath = resolve(REPO_ROOT, 'src', 'generated', 'repo-manifest.json');
    const raw = readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(raw) as { generatedAt: string; issues: Array<{ title: string }> };

    const age = Date.now() - new Date(manifest.generatedAt).getTime();
    // Allow up to 10 minutes; in practice it is seconds.
    expect(age, 'manifest must have been generated in this session (< 10 min)').toBeLessThan(
      10 * 60 * 1000,
    );

    // The manifest must contain the sentinel.
    const found = manifest.issues.some(i => i.title === sentinelTitle);
    expect(found, `sentinel issue "${sentinelTitle}" must be in manifest.issues`).toBe(true);
  });
});
