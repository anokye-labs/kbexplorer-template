#!/usr/bin/env node
/**
 * Seed the Gitea twin so the kbexplorer app (remote/repo-aware mode) has a
 * faithful, mutating universe to render: the real repo content on `main`, plus
 * baseline issues and an open PR that the scenario specs and actors then evolve.
 *
 * Idempotent: re-running reconciles to the desired baseline. The repo content is
 * a **snapshot of the actual working tree** (gitignored paths like node_modules
 * and .dtu are excluded by `git add -A`), pushed as a single root commit to
 * `main` — so the twin mirrors what GitHub would serve for this repo.
 *
 * Usage: node twins/gitea/seed.mjs
 * Needs: a running Gitea + `.dtu/state.json` (run bootstrap.mjs first).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPO_ROOT, readState, ensureDtuDir, DTU_DIR } from './state.mjs';
import {
  coords, ensureOrg, ensureRepo, ensureIssue, ensureBranch, ensurePull,
  putFile, getContents, listIssues, listPulls, gitea,
} from './gitea-client.mjs';

function log(msg) { console.log(`[seed] ${msg}`); }

function git(args, env = {}) {
  return execFileSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  }).trim();
}

/** Push a snapshot of the current working tree to the twin's `main` as one commit. */
function snapshotPushMain(owner, repo) {
  const state = readState();
  const remote = `http://${encodeURIComponent(state.admin.username)}:${state.token}@localhost:3000/${owner}/${repo}.git`;
  ensureDtuDir();
  const indexFile = resolve(DTU_DIR, 'seed-index');
  if (existsSync(indexFile)) rmSync(indexFile);
  const env = {
    GIT_INDEX_FILE: indexFile,
    GIT_AUTHOR_NAME: 'DTU Seed', GIT_AUTHOR_EMAIL: 'dtu-seed@example.com',
    GIT_COMMITTER_NAME: 'DTU Seed', GIT_COMMITTER_EMAIL: 'dtu-seed@example.com',
  };
  log('staging working-tree snapshot (respecting .gitignore)…');
  git(['add', '-A'], env);
  const tree = git(['write-tree'], env);
  const commit = git(['commit-tree', tree, '-m', 'DTU seed: working-tree snapshot'], env);
  log(`force-pushing snapshot ${commit.slice(0, 8)} → ${owner}/${repo}@main`);
  git(['push', '--force', remote, `${commit}:refs/heads/main`], env);
  if (existsSync(indexFile)) rmSync(indexFile);
  // The repo is created with auto_init (born non-empty); this force-push just
  // replaces that initial commit so `main` mirrors the working tree.
}

async function setDefaultBranch(owner, repo, branch) {
  await gitea('PATCH', `/repos/${owner}/${repo}`, { default_branch: branch }).catch(() => {});
}

/**
 * Gate any pull-request operation on the repo being genuinely pull-ready.
 *
 * Gitea's `/repos/{owner}/{repo}/pulls` route is guarded by `mustAllowPulls`,
 * which 404s (with the generic API NotFound `/api/swagger` body) whenever
 * `CanEnablePulls()` is false — i.e. while the repo is still flagged empty. We
 * create the repo with auto_init so it is non-empty from birth, but also poll
 * the repo metadata here so a still-empty repo (e.g. a warm twin from before
 * this fix) fails loudly with an actionable message instead of a cryptic 404.
 */
async function waitForRepoReady(owner, repo, branch, { timeoutMs = 20000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let detail = 'no response from Gitea';
  while (Date.now() < deadline) {
    try {
      const meta = await gitea('GET', `/repos/${owner}/${repo}`);
      if (meta.ok && meta.json && meta.json.empty === false) {
        const head = await gitea('GET', `/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`);
        if (head.ok) return;
        detail = `default branch "${branch}" not resolvable yet (${head.status})`;
      } else {
        detail = meta.ok ? 'repo still reports empty (is_empty=true)' : `repo metadata ${meta.status}`;
      }
    } catch (err) {
      // Gitea can be briefly unreachable during bring-up; gitea()'s underlying
      // fetch() throws on transient connection errors/timeouts. Swallow those and
      // keep polling until the deadline rather than aborting the seed — that is
      // the whole point of the readiness gate. A genuinely never-ready repo still
      // fails loudly at the timeout below.
      detail = `transient fetch error: ${err?.message ?? err}`;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    `repo ${owner}/${repo} is not pull-ready (${detail}); ` +
    'Gitea disables the pulls route on empty repos. Try `npm run dtu:reset`.',
  );
}

const BASELINE_ISSUES = [
  { title: 'DTU: Improve graph node legibility at high zoom', body: 'Nodes overlap when the graph is dense. Track legibility tuning here.', labels: ['enhancement'] },
  { title: 'DTU: Document the source-of-truth editor flow', body: 'Add docs for the F5 editor → GitHub PR write-back handoff.', labels: ['documentation'] },
  { title: 'DTU: Cache invalidation edge case on rapid refresh', body: 'Investigate ETag/TTL interaction when content changes within the TTL window.', labels: ['bug'] },
];

async function seedSourceEditPr(owner, repo, branch) {
  const title = 'DTU: tweak Ada profile (baseline PR)';
  const existing = (await listPulls(owner, repo, { state: 'all' })).find((p) => p.title === title);
  if (existing) { log(`baseline PR already present: #${existing.number}`); return existing; }

  const prBranch = 'dtu/seed-pr';
  // Recreate the branch fresh from the current main snapshot.
  await gitea('DELETE', `/repos/${owner}/${repo}/branches/${prBranch}`).catch(() => {});
  await ensureBranch(owner, repo, prBranch, branch);

  const path = 'content-model/people/ada.yaml';
  const current = await getContents(owner, repo, path, prBranch);
  let next;
  if (current && current.content) {
    const decoded = Buffer.from(current.content, 'base64').toString('utf8');
    next = decoded.includes('# edited by DTU seed')
      ? decoded
      : `${decoded.replace(/\s*$/, '')}\n# edited by DTU seed\n`;
  } else {
    next = 'name: Ada\nrole: Engineer\n# edited by DTU seed\n';
  }
  await putFile(owner, repo, path, { content: next, message: 'DTU: tweak Ada profile', branch: prBranch });
  const { pull } = await ensurePull(owner, repo, {
    title, head: prBranch, base: branch,
    body: 'Baseline open PR seeded by the DTU harness so the app has a PR node to render.',
  });
  log(`baseline PR ready: #${pull.number}`);
  return pull;
}

async function main() {
  const state = readState();
  if (!state || !state.token) {
    throw new Error('Missing .dtu/state.json — run `node twins/gitea/bootstrap.mjs` first.');
  }
  const { owner, repo, branch } = coords();
  log(`seeding ${owner}/${repo}@${branch}`);

  await ensureOrg(owner);
  await ensureRepo(owner, repo, { autoInit: true });
  snapshotPushMain(owner, repo);
  await setDefaultBranch(owner, repo, branch);
  // Block until Gitea reports the repo non-empty with `branch` resolvable, so the
  // pulls route is enabled before seedSourceEditPr/listPulls touch it.
  await waitForRepoReady(owner, repo, branch);

  let created = 0;
  for (const spec of BASELINE_ISSUES) {
    const { created: isNew, issue } = await ensureIssue(owner, repo, spec);
    if (isNew) { created += 1; log(`issue #${issue.number} created: ${issue.title}`); }
  }
  log(`baseline issues: ${created} created, ${BASELINE_ISSUES.length - created} already present`);

  await seedSourceEditPr(owner, repo, branch);

  const issues = (await listIssues(owner, repo, { state: 'all' })).filter((i) => !i.pull_request);
  const pulls = await listPulls(owner, repo, { state: 'all' });
  log(`seed complete ✅  (${issues.length} issues, ${pulls.length} pulls on ${owner}/${repo})`);
}

main().catch((err) => { console.error(`[seed] FAILED: ${err.message}`); process.exit(1); });
