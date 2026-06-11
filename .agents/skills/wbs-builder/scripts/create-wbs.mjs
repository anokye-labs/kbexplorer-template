// WBS runner: materialize an Epic → Feature → Task work-breakdown structure as
// real GitHub issues via the GraphQL API — with native issue TYPES, parent/child
// sub-issue links, and blocked-by dependency edges.
//
// Design goals:
//   • Idempotent + resumable: persists a key→{id,number,url} map to wbs-map.json
//     and skips anything already done. Safe to re-run any phase.
//   • NO hardcoded node IDs. Repository IDs and (org-scoped) issue-type IDs are
//     DISCOVERED at runtime, per owner/repo, by NAME — never carried over from
//     another org. Issue types differ per organization and may be absent on
//     user-owned repos, so we resolve them fresh and fail loudly if missing.
//
// Usage (run from this scripts/ dir, or pass --data):
//   node create-wbs.mjs discover            # preflight: print resolved repo + type IDs
//   node create-wbs.mjs create              # phase 1: create issues (type + body)
//   node create-wbs.mjs sub                 # phase 2: parent → child sub-issues
//   node create-wbs.mjs deps                # phase 3: blocked-by dependency edges
//   node create-wbs.mjs all                 # discover + create + sub + deps
//   node create-wbs.mjs all --dry-run       # resolve + plan, mutate nothing
//   node create-wbs.mjs all --data ./my-wbs-data.mjs --map ./my-map.json
//
// Auth: uses $GITHUB_TOKEN / $GH_TOKEN if set, else `gh auth token`.
// A classic `repo` scope (or fine-grained Issues: read&write) is sufficient —
// issue types, sub-issues, and dependencies do NOT require `read:org`.

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));

// ── args ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const phase = argv.find((a) => !a.startsWith('--')) || 'all';
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : undefined;
};
const DRY = Boolean(flag('dry-run'));
const DATA_PATH = resolvePath(__dir, String(flag('data') || './wbs-data.mjs'));
const MAP_PATH = resolvePath(__dir, String(flag('map') || './wbs-map.json'));

// ── token ──────────────────────────────────────────────────────────────────
const TOKEN =
  process.env.GITHUB_TOKEN ||
  process.env.GH_TOKEN ||
  execSync('gh auth token', { encoding: 'utf8' }).trim();
if (!TOKEN) {
  console.error('No token: set $GITHUB_TOKEN/$GH_TOKEN or run `gh auth login`.');
  process.exit(2);
}

async function gql(query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      // Without this header the type/sub-issue/dependency fields + mutations do
      // not exist. Keep all three opt-ins on every request.
      'GraphQL-Features': 'issue_types,sub_issues,issue_dependencies',
    },
    body: JSON.stringify({ query, variables }),
  });
  // Surface HTTP-level failures (401/403, rate limits, 5xx/outage, HTML error
  // pages) as concise errors instead of letting res.json() throw or return a
  // non-GraphQL shape that fails confusingly downstream.
  const text = await res.text();
  if (!res.ok) {
    const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 200);
    throw new Error(`GitHub GraphQL HTTP ${res.status} ${res.statusText}${snippet ? `: ${snippet}` : ''}`);
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 200);
    throw new Error(`GitHub GraphQL returned non-JSON (HTTP ${res.status})${snippet ? `: ${snippet}` : ''}`);
  }
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

// ── load WBS definition + resumable id map ───────────────────────────────────
if (!existsSync(DATA_PATH)) {
  console.error(`WBS data file not found: ${DATA_PATH}\n(copy wbs-data.example.mjs and edit it)`);
  process.exit(2);
}
const { REPOS, KIND_TYPE_NAMES, ITEMS, DEPS } = await import(pathToFileURL(DATA_PATH).href);
const KIND_NAME = KIND_TYPE_NAMES || { epic: 'Epic', feature: 'Feature', task: 'Task', bug: 'Bug' };

// Validate the WBS definition upfront so misconfiguration fails with an
// actionable message instead of a low-signal TypeError partway through a run.
function validateWbs() {
  const errs = [];
  if (!REPOS || typeof REPOS !== 'object') errs.push('REPOS is missing or is not an object.');
  if (!Array.isArray(ITEMS)) errs.push('ITEMS is missing or is not an array.');
  const repoKeys = new Set(Object.keys(REPOS || {}));
  const knownKinds = Object.keys(KIND_NAME).join(', ');
  const itemKeys = new Set();

  for (const [idx, it] of (Array.isArray(ITEMS) ? ITEMS : []).entries()) {
    const where = `ITEMS[${idx}]${it && it.key ? ` (${it.key})` : ''}`;
    if (!it || typeof it !== 'object') { errs.push(`${where}: not an object.`); continue; }
    if (!it.key || typeof it.key !== 'string') errs.push(`${where}: missing string "key".`);
    else if (itemKeys.has(it.key)) errs.push(`${where}: duplicate key "${it.key}".`);
    else itemKeys.add(it.key);
    if (!repoKeys.has(it.repo)) errs.push(`${where}: unknown repo "${it.repo}" (REPOS keys: ${[...repoKeys].join(', ') || 'none'}).`);
    if (!KIND_NAME[it.kind]) errs.push(`${where}: unknown kind "${it.kind}" (KIND_TYPE_NAMES: ${knownKinds}).`);
    if (typeof it.title !== 'string') errs.push(`${where}: "title" must be a string.`);
    if (typeof it.body !== 'string') errs.push(`${where}: "body" must be a string.`);
  }
  for (const [idx, it] of (Array.isArray(ITEMS) ? ITEMS : []).entries()) {
    if (it && it.parent && !itemKeys.has(it.parent)) {
      errs.push(`ITEMS[${idx}]${it.key ? ` (${it.key})` : ''}: parent "${it.parent}" is not a known item key.`);
    }
  }
  for (const [i, dep] of (Array.isArray(DEPS) ? DEPS : []).entries()) {
    if (!Array.isArray(dep) || dep.length !== 2) { errs.push(`DEPS[${i}]: expected a [key, blockedByKey] pair.`); continue; }
    const [key, by] = dep;
    if (!itemKeys.has(key)) errs.push(`DEPS[${i}]: unknown item key "${key}".`);
    if (!itemKeys.has(by)) errs.push(`DEPS[${i}]: unknown blocking key "${by}".`);
  }

  if (errs.length) {
    console.error(`Invalid WBS data in ${DATA_PATH}:\n  - ${errs.join('\n  - ')}`);
    process.exit(2);
  }
}
validateWbs();

const map = existsSync(MAP_PATH) ? JSON.parse(readFileSync(MAP_PATH, 'utf8')) : {};
const save = () => writeFileSync(MAP_PATH, JSON.stringify(map, null, 2));

// ── mutations ────────────────────────────────────────────────────────────────
const CREATE = `mutation($repo:ID!,$title:String!,$body:String!,$type:ID!){
  createIssue(input:{repositoryId:$repo,title:$title,body:$body,issueTypeId:$type}){
    issue{ id number url }
  }
}`;
const ADD_SUB = `mutation($parent:ID!,$child:ID!){
  addSubIssue(input:{issueId:$parent,subIssueId:$child}){ issue{ number } }
}`;
const ADD_BLOCKED = `mutation($issue:ID!,$by:ID!){
  addBlockedBy(input:{issueId:$issue,blockingIssueId:$by}){ issue{ number } }
}`;
const DISCOVER = `query($owner:String!,$name:String!){
  repository(owner:$owner,name:$name){
    id
    owner{ __typename login }
    issueTypes(first:50){ nodes{ id name } }
  }
}`;

// ── Phase 0: discover repo + issue-type IDs (per owner/repo, by name) ─────────
// Populates `resolved[repoKey] = { repoId, owner, types: {Name: id} }`.
const resolved = {};
async function discover() {
  for (const [repoKey, r] of Object.entries(REPOS)) {
    const data = await gql(DISCOVER, { owner: r.owner, name: r.name });
    const repo = data.repository;
    if (!repo) throw new Error(`Repo not found / no access: ${r.owner}/${r.name}`);
    const types = {};
    for (const t of repo.issueTypes?.nodes || []) types[t.name] = t.id;
    resolved[repoKey] = { repoId: repo.id, owner: r.owner, name: r.name, types };

    const want = [...new Set(ITEMS.filter((i) => i.repo === repoKey).map((i) => KIND_NAME[i.kind]))];
    const missing = want.filter((n) => !types[n]);
    console.log(
      `discovered ${r.owner}/${r.name} (${repo.owner.__typename}) — types: ` +
        (Object.keys(types).join(', ') || '(none)')
    );
    if (missing.length) {
      throw new Error(
        `${r.owner}/${r.name} is missing required issue type(s): ${missing.join(', ')}. ` +
          `Issue types are an ORG-level setting; a user-owned repo may have none. ` +
          `Enable/define them in the org's settings, or adjust KIND_TYPE_NAMES to match ` +
          `the org's actual type names (found: ${Object.keys(types).join(', ') || 'none'}).`
      );
    }
  }
}

const typeIdFor = (item) => resolved[item.repo].types[KIND_NAME[item.kind]];
const repoIdFor = (item) => resolved[item.repo].repoId;

async function main() {
  // discovery is a prerequisite for every mutating phase
  if (['discover', 'create', 'sub', 'deps', 'all'].includes(phase)) await discover();
  if (phase === 'discover') {
    console.log(`\n== discovery OK for ${Object.keys(REPOS).length} repo(s) ==`);
    return;
  }

  // ── Phase 1: create issues (type + body) ───────────────────────────────────
  if (phase === 'all' || phase === 'create') {
    for (const it of ITEMS) {
      if (map[it.key]?.id) { console.log(`skip create ${it.key} (#${map[it.key].number})`); continue; }
      if (DRY) { console.log(`DRY create ${it.key} -> ${it.repo} as ${KIND_NAME[it.kind]}`); continue; }
      const data = await gql(CREATE, {
        repo: repoIdFor(it), title: it.title, body: it.body, type: typeIdFor(it),
      });
      const issue = data.createIssue.issue;
      map[it.key] = {
        id: issue.id, number: issue.number, url: issue.url,
        repo: it.repo, kind: it.kind, parent: it.parent || null,
      };
      save();
      console.log(`created ${it.key} -> ${resolved[it.repo].owner}/${resolved[it.repo].name}#${issue.number}`);
    }
  }

  // ── Phase 2: parent/child sub-issues ───────────────────────────────────────
  if (phase === 'all' || phase === 'sub') {
    for (const it of ITEMS) {
      if (!it.parent) continue;
      const child = map[it.key], parent = map[it.parent];
      if (!child || !parent) { console.log(`MISS sub ${it.key} (create first)`); continue; }
      if (child.parentLinked) { console.log(`skip sub ${it.key}`); continue; }
      if (child.subError) { console.log(`skip sub ${it.key} (prior error recorded; clear "subError" in ${MAP_PATH} to retry)`); continue; }
      if (DRY) { console.log(`DRY sub ${it.parent} <- ${it.key}`); continue; }
      try {
        await gql(ADD_SUB, { parent: parent.id, child: child.id });
        delete child.subError;
        child.parentLinked = true; save();
        console.log(`sub ${it.parent} <- ${it.key}`);
      } catch (e) {
        // Cross-repo / permission rejections: persist a marker so we don't retry
        // on every run, and add a prose "Part of #N" / "Relates to owner/repo#N"
        // body link by hand instead (see SKILL.md). Clear "subError" to retry.
        child.subError = `ERR:${e.message.slice(0, 120)}`; save();
        console.log(`ERR sub ${it.parent} <- ${it.key}: ${e.message.slice(0, 160)} (recorded; clear subError to retry)`);
      }
    }
  }

  // ── Phase 3: blocked-by dependencies ───────────────────────────────────────
  if (phase === 'all' || phase === 'deps') {
    map.__deps = map.__deps || {};
    for (const [key, by] of DEPS || []) {
      const tag = `${key}<-${by}`;
      if (map.__deps[tag] === true || map.__deps[tag] === 'cross') { console.log(`skip dep ${tag}`); continue; }
      const issue = map[key], blocker = map[by];
      if (!issue || !blocker) { console.log(`MISS dep ${tag} (create first)`); continue; }
      const crossRepo = issue.repo !== blocker.repo;
      if (DRY) { console.log(`DRY dep ${key} blocked-by ${by}${crossRepo ? ' (cross-repo)' : ''}`); continue; }
      try {
        await gql(ADD_BLOCKED, { issue: issue.id, by: blocker.id });
        map.__deps[tag] = crossRepo ? 'cross' : true; save();
        console.log(`dep ${key} blocked-by ${by}${crossRepo ? ' (cross-repo)' : ''}`);
      } catch (e) {
        // Cross-repo edges may be rejected; record it and fall back to a prose
        // "Relates to owner/repo#N" body link (see SKILL.md) by hand.
        map.__deps[tag] = `ERR:${e.message.slice(0, 120)}`; save();
        console.log(`ERR dep ${tag}: ${e.message.slice(0, 160)}`);
      }
    }
  }

  const created = ITEMS.filter((i) => map[i.key]?.id).length;
  console.log(`\n== ${created}/${ITEMS.length} issues; map at ${MAP_PATH} ==`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
