---
id: "spec-graph-store"
title: "Graph Store Spec"
emoji: "Database"
cluster: design
derived: true
connections: []
---

The graph store specification describes a durable SQLite backing layer for the knowledge graph. Designed as part of the Graph Provider Architecture ([#40](https://github.com/anokye-labs/kbexplorer-template/issues/40)) and tracked in [#42](https://github.com/anokye-labs/kbexplorer-template/issues/42).

## Problem

Currently, the knowledge graph is rebuilt from scratch on every page load. For large repositories with hundreds of nodes, this creates noticeable startup latency. The [GitHub API](github-api) rate limit (60 req/hour unauthenticated) compounds the problem.

## Solution

A SQLite database caches the computed graph: nodes table with identity URN and content hash, edges table with type/weight/direction, metadata table for timestamps and version.

## How It Connects

The store sits between [providers](providers-overview) and the [graph engine](graph-engine). Providers write to the store; the engine reads from it. The [orchestrator](orchestrator) checks the store before running providers — if cached data is fresh, providers are skipped.

The [identity system](identity) provides stable URNs as primary keys. The [node mapping](node-mapping) system's file-based identities enable incremental updates. The [cache system](cache-system) in `github.ts` could defer to the store for persistence. The [local loader](local-loader) could write during manifest generation.

## Status

The spec is complete. The provider interface was implemented in commit `930f94c`. SQLite integration is a future phase of the [provider architecture spec](spec-providers-overview). The [content pipeline](content-pipeline) would gain a persistence layer.
