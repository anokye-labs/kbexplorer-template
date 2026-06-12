---
id: "theming-escape-hatches"
title: "Escape Hatches: File, CSS & JS Module"
emoji: "PlugConnected"
cluster: guide
connections: [theming-overview, theming-named-themes, theming-scoped, wiki-configuration]
---

When the structured options aren't enough, three escape hatches give you
progressively more power — and require progressively more trust.

## Option B — External theme file

Keep your themes out of `config.yaml` in a dedicated file:

```yaml
# config.yaml
theme:
  themesFile: content/themes/extra-themes.yaml
```

```yaml
# content/themes/extra-themes.yaml — same shape as config.theme
themes:
  forest:
    base: dark
    brand: "#2E7D32"
    tokens:
      colorNeutralBackground1: "#0B1A0B"
```

It's fetched at runtime like `config.yaml` and merged into the theme map. The
external file **wins** over inline `theme.themes` for same-named keys. A missing
or malformed file is ignored (a single warning) — the app still works.

## Option C — Raw CSS override sheet

For surfaces no token can reach, inject a raw stylesheet:

```yaml
branding:
  css: content/overrides.css        # or an absolute https:// URL
```

```css
/* overrides.css */
:root {
  --colorNeutralBackground1: #0d0d12;
  --kbe-font-heading: "Inter", sans-serif;
}
```

The sheet is injected **last** in `<head>`, so its declarations win the cascade.
Repo-relative paths are resolved like other assets; absolute URLs are used
verbatim. Unset ⇒ nothing injected.

## Option D — Custom JS theme module

The most powerful (and most security-sensitive) hatch: a host-provided ESM
module that exports a Fluent `Theme`, a `themes` record, or a `BrandVariants` /
seed. It is dynamically `import()`ed and registered into the cycle:

```yaml
theme:
  moduleUrl: content/themes/my-theme.js   # repo-relative or absolute URL
  moduleThemeName: neon                    # name for a single exported theme
```

```js
// my-theme.js
export const brand = "#FF0480";   // turned into a full ramp
export const base  = "dark";
```

Any failure (network, bad module, wrong shape) logs one warning and is a no-op.

### ⚠️ Security & CSP

`moduleUrl` **executes host-provided JavaScript** in the page, so it is an
explicit, off-by-default opt-in. Before using it:

- **Self-host** the module in a repo you already trust; avoid third-party URLs.
- In **local/dev** mode the module is same-origin (`script-src 'self'` is enough).
- In **remote** mode a repo-relative `moduleUrl` resolves to a cross-origin
  `raw.githubusercontent.com/...` URL. This usually **won't work as-is**: ES
  module imports require a JavaScript MIME type, and `raw.githubusercontent.com`
  serves files as `text/plain`, so the browser refuses the import (a safe
  no-op). For remote mode, use an **absolute URL** to a host you control that
  serves the file with `text/javascript` / `application/javascript`, and allow
  that origin in **both** `script-src` and `connect-src` in your CSP.
- Never use `'unsafe-eval'` to make a module work.

Prefer the non-executable hatches ([external file](#option-b--external-theme-file)
or [raw CSS](#option-c--raw-css-override-sheet)) whenever they can express what
you need. Full details live in the [configuration reference](wiki-configuration).
