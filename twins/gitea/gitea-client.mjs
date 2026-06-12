/**
 * Minimal Gitea `/api/v1` REST client for the DTU harness (seed + actors).
 *
 * Deterministic, dependency-free (uses global fetch). The admin token is read
 * from `.dtu/state.json` via resolveGiteaConfig() and only ever travels
 * server-side — it is never handed to the browser. Every helper is written to
 * be idempotent at the call site so seed/actor scripts can be re-run safely.
 */
import { resolveGiteaConfig, readState, HARNESS } from './state.mjs';

function api() {
  const { giteaApi, token } = resolveGiteaConfig();
  if (!token) {
    throw new Error('No Gitea token in .dtu/state.json — run `node twins/gitea/bootstrap.mjs` first.');
  }
  return { base: `${giteaApi.replace(/\/$/, '')}/api/v1`, token };
}

async function gitea(method, path, body) {
  const { base, token } = api();
  const headers = { Authorization: `token ${token}`, Accept: 'application/json' };
  const init = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${base}${path}`, init);
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : undefined; } catch { json = text; }
  return { ok: res.ok, status: res.status, json, text };
}

/** Coordinates (owner/repo/branch) the harness operates on. */
export function coords() {
  const s = readState() ?? {};
  return {
    owner: s.owner ?? HARNESS.owner,
    repo: s.repo ?? HARNESS.repo,
    branch: s.branch ?? HARNESS.branch,
  };
}

/** Create the org if missing (idempotent). */
export async function ensureOrg(owner) {
  const get = await gitea('GET', `/orgs/${owner}`);
  if (get.ok) return { created: false };
  const res = await gitea('POST', '/orgs', { username: owner });
  if (!res.ok && res.status !== 422) {
    throw new Error(`ensureOrg(${owner}) failed: ${res.status} ${res.text}`);
  }
  return { created: res.ok };
}

/** Create the repo under the org if missing (idempotent). No auto-init: seed pushes a snapshot. */
export async function ensureRepo(owner, repo, { autoInit = false } = {}) {
  const get = await gitea('GET', `/repos/${owner}/${repo}`);
  if (get.ok) return { created: false };
  const res = await gitea('POST', `/orgs/${owner}/repos`, {
    name: repo,
    private: false,
    default_branch: 'main',
    auto_init: autoInit,
  });
  if (!res.ok) throw new Error(`ensureRepo(${owner}/${repo}) failed: ${res.status} ${res.text}`);
  return { created: true };
}

export async function listIssues(owner, repo, { state = 'all', type } = {}) {
  const params = new URLSearchParams({ state, limit: '50' });
  if (type) params.set('type', type);
  const all = [];
  let page = 1;
  while (true) {
    params.set('page', String(page));
    const res = await gitea('GET', `/repos/${owner}/${repo}/issues?${params}`);
    if (!res.ok) throw new Error(`listIssues failed: ${res.status} ${res.text}`);
    const chunk = Array.isArray(res.json) ? res.json : [];
    all.push(...chunk);
    if (chunk.length < 50) break;
    page += 1;
  }
  return all;
}

/** Create an issue (optionally with labels by name). Returns the created issue. */
export async function createIssue(owner, repo, { title, body = '', labels = [] } = {}) {
  const labelIds = labels.length ? await resolveLabelIds(owner, repo, labels) : [];
  const res = await gitea('POST', `/repos/${owner}/${repo}/issues`, { title, body, labels: labelIds });
  if (!res.ok) throw new Error(`createIssue("${title}") failed: ${res.status} ${res.text}`);
  return res.json;
}

/** Create an issue only if no open/closed issue with the same title exists. */
export async function ensureIssue(owner, repo, spec) {
  const existing = await listIssues(owner, repo, { state: 'all' });
  const match = existing.find((i) => i.title === spec.title && !i.pull_request);
  if (match) return { created: false, issue: match };
  const issue = await createIssue(owner, repo, spec);
  return { created: true, issue };
}

async function resolveLabelIds(owner, repo, names) {
  const res = await gitea('GET', `/repos/${owner}/${repo}/labels?limit=50`);
  const have = res.ok && Array.isArray(res.json) ? res.json : [];
  const ids = [];
  for (const name of names) {
    let label = have.find((l) => l.name === name);
    if (!label) {
      const created = await gitea('POST', `/repos/${owner}/${repo}/labels`, { name, color: '00aabb' });
      if (created.ok) label = created.json;
    }
    if (label) ids.push(label.id);
  }
  return ids;
}

export async function listPulls(owner, repo, { state = 'all' } = {}) {
  const res = await gitea('GET', `/repos/${owner}/${repo}/pulls?state=${state}&limit=50`);
  if (!res.ok) throw new Error(`listPulls failed: ${res.status} ${res.text}`);
  return Array.isArray(res.json) ? res.json : [];
}

/** Get file contents metadata (incl. sha) at a ref, or null if absent. */
export async function getContents(owner, repo, path, ref) {
  const params = ref ? `?ref=${encodeURIComponent(ref)}` : '';
  const res = await gitea('GET', `/repos/${owner}/${repo}/contents/${path}${params}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getContents(${path}) failed: ${res.status} ${res.text}`);
  return res.json;
}

/** Create a branch from a base branch (idempotent: ignores "already exists"). */
export async function ensureBranch(owner, repo, newBranch, fromBranch) {
  const res = await gitea('POST', `/repos/${owner}/${repo}/branches`, {
    new_branch_name: newBranch,
    old_branch_name: fromBranch,
  });
  if (res.ok) return { created: true };
  if (res.status === 409 || /already exists/i.test(res.text)) return { created: false };
  throw new Error(`ensureBranch(${newBranch}) failed: ${res.status} ${res.text}`);
}

/** Create or update a file on a branch via the contents API. Returns the commit. */
export async function putFile(owner, repo, path, { content, message, branch }) {
  const existing = await getContents(owner, repo, path, branch);
  const body = {
    content: Buffer.from(content, 'utf8').toString('base64'),
    message,
    branch,
  };
  let res;
  if (existing && existing.sha) {
    body.sha = existing.sha;
    res = await gitea('PUT', `/repos/${owner}/${repo}/contents/${path}`, body);
  } else {
    res = await gitea('POST', `/repos/${owner}/${repo}/contents/${path}`, body);
  }
  if (!res.ok) throw new Error(`putFile(${path}) failed: ${res.status} ${res.text}`);
  return res.json;
}

/** Create a pull request (idempotent by title). Returns { created, pull }. */
export async function ensurePull(owner, repo, { title, head, base, body = '' }) {
  const existing = await listPulls(owner, repo, { state: 'all' });
  const match = existing.find((p) => p.title === title);
  if (match) return { created: false, pull: match };
  const res = await gitea('POST', `/repos/${owner}/${repo}/pulls`, { title, head, base, body });
  if (!res.ok) throw new Error(`ensurePull("${title}") failed: ${res.status} ${res.text}`);
  return { created: true, pull: res.json };
}

/** Merge a pull request. style: 'merge' | 'rebase' | 'squash'.
 *
 * Gitea computes PR mergeability asynchronously, so a freshly opened PR can
 * briefly return 405 ("not mergeable yet") even when it has no conflicts. Poll
 * the PR until it reports `mergeable`, then merge — retrying on the transient
 * 405 a few times before giving up. */
export async function mergePull(owner, repo, index, { style = 'merge', timeoutMs = 15000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  // 1) Wait for Gitea to finish computing mergeability.
  while (Date.now() < deadline) {
    const pr = await gitea('GET', `/repos/${owner}/${repo}/pulls/${index}`);
    if (pr.ok && pr.json) {
      if (pr.json.merged) return { merged: true };
      if (pr.json.mergeable === true) break;
    }
    await new Promise((r) => setTimeout(r, 750));
  }
  // 2) Attempt the merge, tolerating a transient 405 with a short backoff.
  let last;
  while (Date.now() < deadline) {
    last = await gitea('POST', `/repos/${owner}/${repo}/pulls/${index}/merge`, { Do: style });
    if (last.ok) return { merged: true };
    if (last.status !== 405) {
      throw new Error(`mergePull(#${index}) failed: ${last.status} ${last.text}`);
    }
    await new Promise((r) => setTimeout(r, 750));
  }
  return { merged: false, status: last?.status, detail: last?.text };
}

export { gitea };
