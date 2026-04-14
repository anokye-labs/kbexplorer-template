# Content Derivation & Evaluation

This document describes how to re-derive the entire knowledge graph from the repo's systems of record (source files, issues, PRs, commits) and evaluate the result against the current content.

## Why

The content in `content/` should be **derivable** — not hand-maintained prose that rots. If the derivation pipeline is good enough, deleting `content/` and re-running it should produce something equal or better. Running this evaluation regularly catches:

- Content that has drifted from the code it describes
- Missing coverage for new modules or features
- Link rot (references to nodes that no longer exist)
- Over-linking or under-linking (graph quality regression)

## Pipeline

```
generate-manifest → catalogue.json → enrich-context → catalogue-enriched.json → kb-writer → content/*.md → assess-graph
```

### Step 1: Generate the manifest

```bash
npm run prebuild
```

Produces `src/generated/repo-manifest.json` with the repo tree, issues, PRs, and recent commits.

### Step 2: Create the graph catalogue

Use the `kb-architect` agent (`.github/agents/kb-architect.md`) to analyze the manifest and produce `content/catalogue.json` — a structured node/edge/cluster plan for the knowledge graph. This is **not** a wiki table of contents; it's a graph structure optimized for reachability, readability, and the 40-node/80-edge visibility constraints.

```bash
# The kb-architect agent is invoked via Copilot CLI:
# "Analyze this repo and produce a graph catalogue"
```

### Step 3: Enrich with cross-references

```bash
node scripts/enrich-context.js
```

Reads `catalogue.json` + the manifest and produces `content/catalogue-enriched.json`. Each node gets:
- `relatedIssues` — issues whose body or title references the node's file or concept
- `relatedPRs` — PRs that mention the file
- `recentCommits` — commits that touched the file

This enrichment is what gives derived content its **"WHY"** — without it, derivation produces technically accurate but shallow content.

### Step 4: Generate content

Use the `kb-writer` agent (`.github/agents/kb-writer.md`) to produce markdown files from the enriched catalogue. Each node becomes a `content/{id}.md` with YAML frontmatter, inline links to other nodes, code citations, and structured sections.

```bash
# The kb-writer agent is invoked per node or in batches:
# "Write content for nodes X, Y, Z from the enriched catalogue"
```

### Step 5: Assess quality

```bash
node scripts/assess-graph.js
```

Evaluates the content graph against constraints and quality metrics:

| Metric | Target |
|--------|--------|
| Node count | ≤ 40 per view |
| Edge count | ≤ 80 per view |
| Clusters | ≤ 8 |
| Orphan nodes | 0 |
| Hub reachability | All nodes ≤ 3 hops from hub |
| Avg links/node | 4–15 |
| Bidirectionality | ≥ 50% |
| Avg content depth | ≥ 1,500 chars |

## Running the full evaluation

The evaluation uses a **worktree** so the experiment doesn't touch your working copy:

```bash
# 1. Create a worktree for the experiment
git worktree add ../kbe-derive-exp main

# 2. In the worktree, delete all existing content
cd ../kbe-derive-exp
rm content/*.md

# 3. Run the pipeline (steps 1–4 above)
npm run prebuild
node scripts/enrich-context.js
# Invoke kb-architect → kb-writer agents

# 4. Assess the derived content
node scripts/assess-graph.js

# 5. Compare derived vs baseline
node scripts/compare-content.js --baseline ../kbexplorer/content
```

The `compare-content.js` script produces a side-by-side report:

| Metric | Baseline | Derived |
|--------|----------|---------|
| Node count | — | — |
| Avg chars/node | — | — |
| Avg links/node | — | — |
| Coverage | — | — |

### What to look for

- **Avg chars/node** should be comparable (≥ 2,000). If derived content is much shorter, the enrichment context may be insufficient.
- **Avg links/node** should be higher in derived content (the writer agent is tuned for inline linking). If it's lower, the catalogue may be missing connections.
- **Orphan nodes** should be 0 in both. Any orphans indicate missing edges in the catalogue.
- **New nodes** in derived content that don't exist in baseline may represent coverage gaps the original content missed.
- **Missing nodes** (in baseline but not derived) may indicate content that can't be derived from code alone — candidates for `knowledge/` anchors.

## Cleaning up

```bash
# Remove the worktree when done
cd ../kbexplorer
git worktree remove ../kbe-derive-exp
```

## Prior results

### v2 derivation (PR #77)

| Metric | Baseline | Derived v2 |
|--------|----------|------------|
| Nodes | 45 | 53 |
| Avg chars/node | 3,795 | 3,969 |
| Avg links/node | 6.0 | 14.9 |
| Orphans | 0 | 3 |
| Bidirectionality | — | 39% |

The v2 derived content was merged and is the current production content.

## Future direction

- **Automated scheduled runs** — trigger derivation on a schedule or after significant merges to detect content drift
- **Knowledge anchors** — a `knowledge/` directory for non-derivable information (design decisions, tribal knowledge) that the pipeline incorporates but doesn't overwrite
- **Multi-dimensional derivation** — run derivation in parallel across dimensions (code structure, work items, documentation) and merge the best of each
- **Quality gate** — fail CI if `assess-graph.js` scores drop below thresholds
