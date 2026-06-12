---
id: "theming-scoped"
title: "Scoped Theming: Clusters & Pages"
emoji: "LayerDiagonal"
cluster: guide
accent: "#5C6BC0"
connections: [theming-overview, theming-named-themes, overview-view, reading-view]
---

> This page sets its own `accent` in frontmatter — notice the brand-colored
> surfaces are indigo here, while the global theme is unchanged everywhere else.

Beyond the global theme, you can apply **scoped** color deltas that affect only
part of the site. Scoped deltas are emitted as CSS variables on a container, so
they never mutate the global theme.

## Per-cluster tokens

Add `tokens` to any cluster in `config.yaml`. They apply to that cluster's
surfaces — node cards, badges, and the reading header for nodes in the cluster:

```yaml
clusters:
  ui:
    name: "Interface"
    color: "#8CB050"
    tokens:
      colorBrandBackground: "#FF00AA"
      colorNeutralBackground1: "#2B0030"
```

Only the matching cluster's sections pick up the override; every other cluster
and the document root keep the active theme.

## Per-page frontmatter

Any authored page can restyle itself via frontmatter. Three optional fields:

```yaml
---
id: "my-page"
title: "My Page"
cluster: guide
accent: "#C04040"            # brand seed — recolors brand-family tokens
theme: rose                  # start from a named theme's tokens
tokens:                      # explicit deltas (highest precedence)
  colorNeutralBackground2: "#3A1414"
---
```

The layering within a page is: named `theme` (lowest) → `accent` recolor →
explicit `tokens` (highest). Page deltas also win over cluster deltas for any
overlapping token.

## Restored on navigation

Scoped deltas live on the page/section container, keyed by node id. Navigating
to another node drops the themed container and the global theme is restored
automatically — there is no leakage to the document root.

The [overview view](overview-view) applies cluster deltas to each section, and
the [reading view](reading-view) applies both cluster and page deltas to the
page it renders. For escape hatches that go beyond tokens, see
[modular theming](theming-escape-hatches).
