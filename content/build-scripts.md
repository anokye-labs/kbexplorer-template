---
id: "build-scripts"
title: "Build Scripts"
emoji: "Wrench"
cluster: infra
derived: true
connections: []
---

The build scripts (`scripts/generate-manifest.js` and related tools) automate content preparation for kbexplorer's [local loader](local-loader). The [manifest generator](manifest-generator) is the most critical script — it pre-builds all the data that the [GitHub API](github-api) would provide at runtime, enabling zero-API-call operation.

## Assessment Script

`scripts/assess-graph.js` evaluates the content graph against readability and structural constraints — applying the metrics from the [link assessment spec](spec-link-assessment):

- Node/edge counts vs. limits (50 nodes, 100 edges per view)
- Orphan node detection (0 incoming links)
- Hub reachability (BFS from highest-degree node, target: ≤3 hops)
- Quality scores: connectivity, cluster balance, link density, bidirectionality

## Derivation Scripts

The [catalogue transformer](catalogue-transformer) and related scripts support the Content Derivation Engine ([PR #76](https://github.com/anokye-labs/kbexplorer-template/pull/76)):
- `derive-content.js` — generates content from catalogue entries
- `enrich-context.js` — adds issue/PR/commit context to catalogue entries
- `compare-content.js` — diffs derived vs. baseline content

## Testing

The [test suite](test-suite) covers manifest generation with Vitest tests ([#37](https://github.com/anokye-labs/kbexplorer-template/issues/37)). The [Vite configuration](vite-config) integrates the manifest plugin for seamless development.
