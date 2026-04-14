# Content Derivation & Evaluation

The content in `content/` is **derived** — generated from the repo's systems of record (source files, issues, PRs, commits) by the kbexplorer CLI tool and its agents. This document describes how to use the tool to re-derive and evaluate content.

## Commands

### `kbexplorer derive`

Re-derives the entire knowledge graph content. Orchestrates the full pipeline automatically: scans the repo, builds a graph catalogue, enriches nodes with issue/PR/commit context, and generates content files.

```bash
npx kbexplorer derive
```

The tool creates a **worktree** so the experiment never touches your working copy. When complete, it reports a quality comparison against the current content.

### `kbexplorer assess`

Evaluates the current content graph against quality constraints and produces a score report.

```bash
npx kbexplorer assess
```

### `kbexplorer compare`

Compares two content sets side-by-side (e.g. current vs. newly derived).

```bash
npx kbexplorer compare --baseline content/ --candidate ../kbe-derive-exp/content/
```

## Quality targets

| Metric | Target |
|--------|--------|
| Nodes per view | ≤ 40 |
| Clusters | ≤ 8 |
| Orphan nodes | 0 |
| Hub reachability | ≤ 3 hops |
| Links/node | 4–15 |
| Bidirectionality | ≥ 50% |
| Content depth | ≥ 1,500 chars avg |

## Agents

The CLI deploys two agents during derivation:

- **kb-architect** — analyzes the repo and produces a graph catalogue (node/edge/cluster plan) optimized for reachability and the visibility constraints
- **kb-writer** — generates inline-linked markdown content for each node, grounded in code citations and enriched issue/PR/commit context

These agents are defined in `.github/agents/` and invoked automatically by `kbexplorer derive`.

## When to run

- After significant refactors or new module additions
- When the content feels stale or out of sync with code
- Before releases, to ensure documentation coverage
- On a schedule, to detect drift early

## Prior results

### v2 derivation (PR #77)

| Metric | Baseline | Derived v2 |
|--------|----------|------------|
| Nodes | 45 | 53 |
| Avg chars/node | 3,795 | 3,969 |
| Avg links/node | 6.0 | 14.9 |

The v2 derived content replaced the original hand-authored content and is the current production set.
