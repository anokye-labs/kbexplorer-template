# Changelog

All notable changes to **kbexplorer-template** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Releases are cut as immutable git tags (`vX.Y.Z`) plus a matching GitHub Release.
Host repositories that vendor this template should **pin to a tag**, never track a
moving branch — see [`docs/compatibility.md`](docs/compatibility.md) for the
template ↔ kbexplorer CLI compatibility matrix and the pinning contract.

## [Unreleased]

### Added
- **Rich-Markdown rendering** (#427): a rich-Markdown document view that composes
  frontmatter facts (in the structured view), prose, and inline embedded blocks.
  - An open **block-renderer registry** (`src/views/rich-markdown/`), modeled on the
    viewer registry, that maps a block `kind` to a renderer. The inline-Mermaid path
    is reused as the one live renderer; `dot` / `ics` / `canvas` render from a
    **pre-built SVG**.
  - A **pre-built-SVG fallback contract**: any block that ships an `svg` renders it
    instead of a raw code dump, so a block never degrades to raw code when an SVG
    exists. This replaces the prior raw-code display in the prose diagram walk.
    The provider-supplied SVG is **untrusted**, so it is rendered as an inert
    `<img>` from a `data:image/svg+xml` URL (loaded in the browser's secure static
    mode — no scripts, event handlers, external fetches, or `<foreignObject>` HTML
    can execute), never parsed into the live DOM.
  - Consumes the provider shape `node.data.richMarkdown.blocks` (kbexplorer-cli#133).
  - A `?demo=richmd` seam injects a sample document so the view is viewable without
    a provider.

### Changed
- Bumped `@anokye-labs/kbexplorer-core` to **`#v0.1.0`**.
- `ProseContent` now upgrades non-Mermaid fenced blocks to their pre-built SVG when
  the node carries rich-Markdown blocks; ordinary code fences and the live-Mermaid
  path are unchanged.
- `validateSourceContent` accepts the full `NodeSourceFile['format']` union
  (incl. `'markdown'`) introduced by core v0.1.0.

## [0.2.0] - 2026-06-16

First versioned release since the initial `v0.1.0` tag (143 commits). This release
establishes reproducible **release pinning** for the template.

### Added
- `CHANGELOG.md` (this file) and a CLI ↔ template **compatibility matrix** at
  [`docs/compatibility.md`](docs/compatibility.md).
- Documented **pinning contract**: a host that vendors the template at an immutable
  tag (`vX.Y.Z`) is the supported, reproducible install. `kbexplorer doctor` treats a
  tag-pinned checkout as satisfied and does **not** emit the branch-tracking warning.
- Digital Twin Universe (DTU) exploratory-agent harness and visual-regression review
  gate (carried in since `v0.1.0`).

### Changed
- `package.json` / `package-lock.json` `version` bumped from the placeholder `0.0.0`
  to `0.2.0` so vendored installs report a real, resolvable release.
- Graph "sensemaking" passes: work nodes anchor to `repo-meta`, the work cluster folds,
  and visual density is tuned (see `src/api/github.ts` `CACHE_VERSION` history).

### Notes
- `v0.1.0` remains the initial template release tag; it is immutable and is **not**
  re-pointed. `0.2.0` supersedes it for new installs.

## [0.1.0] - 2026-04-09

### Added
- Initial template release: repo-aware and authored content modes, constellation
  graph, reading view, HUD/minimap, theme switching, and the agent-driven setup skill.

[Unreleased]: https://github.com/anokye-labs/kbexplorer-template/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/anokye-labs/kbexplorer-template/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/anokye-labs/kbexplorer-template/releases/tag/v0.1.0
