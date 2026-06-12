---
id: "theming-branding"
title: "Branding: Logo & Favicon"
emoji: "DesignIdeas"
cluster: guide
connections: [theming-overview, theming-named-themes, app-shell, hud]
---

The optional `branding` block points at image assets in your host repo. All
paths are repo-relative and resolved the same way as other content assets.

## Logo

```yaml
branding:
  logo: content/assets/logo.svg
```

When set, the logo renders in two places:

- the **HomePage hero**, in place of the text title;
- the **HUD** collapsed header, as a persistent brand mark alongside the current
  node title.

When unset, both fall back to the text title — no layout shift. The logo is
marked decorative (`alt=""`) in the HUD so screen readers announce the title
once rather than twice.

## Favicon

```yaml
branding:
  favicon: content/assets/favicon.png
```

The favicon is swapped into the document's `<link rel="icon">` at runtime. When
unset, the static `/favicon.svg` shipped in `index.html` is left untouched.

## Fonts

Typography lives in the `theme` block rather than `branding` — see
[brand, tokens & named themes](theming-named-themes) for `theme.font.*`.

## Sizing notes

Both the hero and HUD use fluid sizing (viewport units and Fluent tokens), so
logos scale cleanly across screen sizes. Provide a reasonably sized asset
(an SVG or a 2x raster) and the layout handles the rest.

The [application shell](app-shell) wires these hooks alongside the theme system;
the [HUD](hud) consumes the logo for its collapsed header.
