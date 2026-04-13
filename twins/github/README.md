# GitHub API Twin

A zero-dependency local server that replays canned GitHub API responses, letting kbexplorer run fully offline without rate limits.

## Capture fixtures

Pull real data from a GitHub repo into `fixtures/`:

```bash
node twins/github/capture.js <owner> <repo>
# Example:
node twins/github/capture.js anokye-labs kbexplorer-template
```

Uses `GITHUB_TOKEN` env var or the `gh` CLI token automatically.

## Start the twin

```bash
node twins/github/server.js
# ⇒ [twin] Serving on http://localhost:3456
```

Override the port with `TWIN_PORT`:

```bash
TWIN_PORT=4000 node twins/github/server.js
```

## Point kbexplorer at the twin

Set the Vite env var so the app talks to the twin instead of `api.github.com`:

```bash
VITE_GH_API_BASE=http://localhost:3456 npx vite
```

## Supported routes

| Route pattern | Fixture file |
|---|---|
| `/repos/:owner/:repo/git/trees/:ref` | `fixtures/tree.json` |
| `/repos/:owner/:repo/issues` | `fixtures/issues.json` |
| `/repos/:owner/:repo/pulls` | `fixtures/pulls.json` |
| `/repos/:owner/:repo/commits` | `fixtures/commits.json` |
| `/repos/:owner/:repo/contents/:path` | `fixtures/files/{encoded-path}.json` |

Pagination: list endpoints return the full fixture on `page=1` (default) and an empty array on subsequent pages.

## gh CLI mock

`gh-mock.js` is a drop-in replacement for the `gh` CLI used by `scripts/generate-manifest.js`. It reads the same fixture files and outputs JSON in the `gh` CLI format (camelCase keys, `url` instead of `html_url`, etc.).

### Supported commands

```
node twins/github/gh-mock.js issue list --json <fields> [--state <state>] [--limit <n>]
node twins/github/gh-mock.js pr    list --json <fields> [--state <state>] [--limit <n>]
```

### Usage with generate-manifest

```bash
# Option 1: alias gh to the mock
alias gh="node $(pwd)/twins/github/gh-mock.js"
node scripts/generate-manifest.js

# Option 2: in tests, override the command that execSync runs
# by pointing execSync at the mock path instead of bare `gh`
```
