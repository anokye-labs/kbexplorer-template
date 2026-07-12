# @anokye-labs/kbexplorer-view-kit

The **render contract** for kbexplorer provider-shipped lenses — the UX-stack
(React + [Fluent](https://react.fluentui.dev/)) half of a dual-half provider.

A provider's **data half** (its `.` entry) depends only on
[`@anokye-labs/kbexplorer-core`](https://www.npmjs.com/package/@anokye-labs/kbexplorer-core)
and stays pure ESM / DOM-free. Its **render half** (the `./views` entry named by
`ProviderModule.views` in core) is inherently React + Fluent specific, so its
contract lives here — published, versioned in lockstep with the surfaces that
consume it, and imported by both third-party providers and the host template so
there is **exactly one definition**.

```
@anokye-labs/kbexplorer-core        →  pure data (KBNode, NodeLens, CalendarModel, ProviderModule.views specifier)
@anokye-labs/kbexplorer-view-kit    →  render contract (this package): ViewerProps, BlockRenderer, ProviderViews, VIEW_API_VERSION
```

## Install

```sh
npm install @anokye-labs/kbexplorer-view-kit
```

- **React is a peer dependency** — supported majors: **React 18 and 19**
  (`^18.0.0 || ^19.0.0`). The consuming app provides React.
- **No Fluent runtime dependency.** Fluent design tokens are consumed as **CSS
  custom properties** only; this package never imports `@fluentui/react-components`.
  The optional presentation primitives emit `kb-*` class hooks the host styles.

## Exports

| Export | Kind | Purpose |
| --- | --- | --- |
| `ViewerProps` | type | Props handed to a viewer — `{ node: KBNode }` (core `KBNode`). |
| `ViewerComponent` | type | `(props: ViewerProps) => ReactNode` — a viewer. |
| `LazyViewer` | type | `() => Promise<{ default: ViewerComponent }>` — a zero-arg, code-split loader (`React.lazy` shape). |
| `BlockRange` | type | Character offsets of a block in the source. |
| `RichMarkdownBlock` | type | Pure-data shape of an embedded block a renderer consumes. |
| `BlockOutput` | type | A renderer's pure decision: `mermaid` \| `svg` \| `viewer` \| `unsupported`. |
| `BlockRenderContext` | type | Context threaded to a renderer (e.g. `isDark`). |
| `BlockRenderer` | type | `(block, ctx?) => BlockOutput`. |
| `ProviderViews` | type | The shape a `./views` entry default-exports: `{ viewers?, blockRenderers? }`. |
| `VIEW_API_VERSION` | const | The view-contract version (semver), bumped independently of core's `PROVIDER_API_VERSION`. |
| `checkViewCompatibility` | fn | Guard a render half's declared version against the host's. |
| `EntityHeader`, `Row`, `Pill`, `ScalarList` | components | Optional house-style presentation primitives. |

### `BlockOutput`

```ts
type BlockOutput =
  | { type: 'mermaid'; source: string; title?: string }
  | { type: 'svg'; svg: string; title?: string }
  | { type: 'viewer'; key: string; data: unknown; title?: string }
  | { type: 'unsupported'; kind: string; source: string; reason: string };
```

The `viewer` member delegates a structured block to a viewer resolved by registry
`key`, handing it a pure-data `data` payload (e.g. a `'calendar-month'` viewer
rendering a core `CalendarModel`).

## Registry semantics (part of the contract)

When a host merges a provider's `ProviderViews` into its registries:

- **Keys are case-insensitive.** A viewer registered for `'Person'` resolves for
  `'person'` / `'PERSON'`; a block renderer for `'Mermaid'` resolves for
  `'mermaid'`. Whitespace-only keys are rejected.
- **Last registration wins.** Registering the same key twice replaces the prior
  entry, so a downstream provider (or the host) can override a built-in.

## Authoring a `./views` entry

The `./views` entry default-exports a `ProviderViews`. The `.` (data) entry stays
pure core-only ESM and MUST NOT import this package or React — importing the data
half must never evaluate the render module graph.

### No-build provider (`React.createElement`, no JSX/precompile)

```ts
// views.js
import { createElement } from 'react';
/** @type {import('@anokye-labs/kbexplorer-view-kit').ProviderViews} */
const views = {
  viewers: {
    quote: ({ node }) => createElement('blockquote', null, node.title),
  },
};
export default views;
```

### JSX provider (precompile **only** the views entry)

```tsx
// views.tsx  — precompiled to ESM; the `.` data entry is left untouched
import type { ProviderViews } from '@anokye-labs/kbexplorer-view-kit';
import { EntityHeader } from '@anokye-labs/kbexplorer-view-kit';

const views: ProviderViews = {
  viewers: {
    quote: ({ node }) => <EntityHeader label="Quote" id={node.identity} />,
  },
  blockRenderers: {
    // return a pure decision — no DOM/React here
    ics: (block) => (block.svg ? { type: 'svg', svg: block.svg } : {
      type: 'unsupported', kind: block.kind, source: block.source,
      reason: 'no live ICS renderer and no pre-built SVG',
    }),
  },
};
export default views;
```

## Compatibility

`VIEW_API_VERSION` follows semver with same-major-compatible semantics: a
same-major render half is compatible; a different major is breaking; a render
half may not require a newer minor than the host supports. Use
`checkViewCompatibility(declared, host?)` to guard before mounting a render half
(mirrors core's `checkProviderCompatibility`).

## License

MIT
