# kbexplorer Configuration Reference

Complete reference for `config.yaml` — the configuration file that controls
kbexplorer's behavior, appearance, and content.

## Location

- **Authored mode**: `{source.path}/config.yaml` (e.g., `content/config.yaml`)
- **Repo-aware mode**: `content/config.yaml` in the target repo

## Full Schema

```yaml
# Display metadata
title: "My Knowledge Base"          # Required. Page title and header text.
subtitle: "An explorable guide"     # Optional. Shown below the title.
author: "Your Name"                 # Optional. Attribution.
date: "2025"                        # Optional. Date string.

# Content source
source:
  owner: your-org                   # Required. GitHub owner (org or user).
  repo: your-repo                   # Required. GitHub repository name.
  path: content                     # Optional. Content directory for authored mode.
                                    #   Omit for repo-aware mode.
  branch: main                      # Optional. Git branch (default: main).

# Cluster definitions — group nodes by topic
clusters:
  cluster-key:                      # Key referenced in node frontmatter.
    name: "Display Name"            # Human-readable cluster name.
    color: "#4A9CC8"                # Hex color for cluster visuals.

# Visual identity system
visuals:
  mode: emoji                       # Primary visual mode.
                                    #   Options: sprites | heroes | emoji | none
  fallback: emoji                   # Fallback when primary asset is missing.
  hero:                             # Heroes mode settings (optional).
    overlay: dark-gradient           #   Overlay style: dark-gradient | light-gradient | none
    height: "300px"                  #   Hero image height.
    animation: reveal                #   Animation: reveal | fade | none
  hud:                              # HUD visual settings (optional).
    blurBackground: true             #   Enable backdrop blur on HUD.
    blurOpacity: 0.8                 #   Blur opacity (0-1).
  graph:                            # Graph view settings (optional).
    nodeImages: true                 #   Show images on graph nodes.
    nodeSizeByConnections: true      #   Scale node size by connection count.

# Theme configuration
theme:
  default: dark                     # Default theme: dark | light | sepia
  font:                             # Optional font overrides.
    heading: "Instrument Serif"      #   Heading font family.
    body: "General Sans"             #   Body text font family.
    mono: "JetBrains Mono"           #   Code/monospace font family.
  # ── Theme escape hatches (F5) — all optional, off by default ──
  themesFile: content/themes.yaml   # Optional. Path to a dedicated host-repo theme
                                    #   file (same shape as `theme`); its named
                                    #   themes merge into the THEME_MAP (T5.1).
  moduleUrl: theme/my-theme.js      # ⚠️ Optional, SECURITY-sensitive. Path/URL to a
                                    #   custom ESM JS module that exports a Fluent
                                    #   Theme / BrandVariants; dynamically import()ed
                                    #   and registered into the THEME_MAP (T5.3).
                                    #   See "Custom JS theme module" below.
  moduleThemeName: brand            # Optional. Name a single module theme is
                                    #   registered/cycled under (default: "custom").

# Graph physics and layout
graph:
  physics: true                     # Enable physics simulation.
  layout: force-atlas-2             # Layout algorithm: force-atlas-2 | manual

# Feature flags
features:
  hud: true                        # Show the HUD (minimap + related nodes).
  minimap: true                    # Show minimap in HUD.
  readingTools: true               # Show reading tools (copy, highlight, etc.).
  keyboardNav: true                # Enable keyboard navigation shortcuts.
  sparkAnimation: false            # Enable spark animation on nodes.

# BLUF (Bottom Line Up Front) — optional intro screen
bluf:
  quote: "Knowledge is the path."  # Quote shown on intro screen.
  duration: "5s"                   # How long the intro screen displays.
  audio: "assets/intro.mp3"        # Optional audio file for intro.
```

## Cluster Best Practices

Define clusters that match the natural categories of content:

**For repo-aware mode** (issue labels become clusters):
```yaml
clusters:
  feature:
    name: Feature
    color: "#4A9CC8"
  bug:
    name: Bug
    color: "#C04040"
  enhancement:
    name: Enhancement
    color: "#8CB050"
  documentation:
    name: Documentation
    color: "#D4A050"
```

**For authored mode** (define your own taxonomy):
```yaml
clusters:
  concept:
    name: Concepts
    color: "#4A9CC8"
  tutorial:
    name: Tutorials
    color: "#8CB050"
  reference:
    name: Reference
    color: "#E8A838"
  example:
    name: Examples
    color: "#A86FDF"
```

Clusters not defined in config but present in content are auto-generated with
colors from a built-in palette.

## Custom JS theme module (`theme.moduleUrl`) — the most powerful escape hatch

`theme.moduleUrl` lets a host repo ship its **own ESM JavaScript module** that
programmatically builds a Fluent theme. kbexplorer dynamically `import()`s the
module at runtime and registers the result into the theme map, so it becomes
selectable and cyclable alongside the built-ins (`dark`/`light`/`sepia`) and any
`theme.themes` / `themesFile` entries.

### Supported export shapes

```js
// theme/my-theme.js  (an ESM module in your repo, served as application/javascript)
import { createDarkTheme } from '@fluentui/react-components'; // if you self-bundle

// 1. A fully-built Fluent Theme (named export `theme`, or default export):
export const name = 'brand';            // optional; names the cycle entry
export const theme = { /* a Fluent Theme object */ };

// 2. A record of named themes:
export const themes = { brandDark: {/*Theme*/}, brandLight: {/*Theme*/} };

// 3. A BrandVariants ramp or seed hex kbexplorer turns into a Theme:
export const brand = '#FF2D95';         // seed hex → generateBrandVariants → Theme
export const base = 'dark';             // optional: 'dark' (default) | 'light'
// (or `export const brandVariants = { 10: '#...', …, 160: '#...' }`,
//  or `export const seed = '#FF2D95'`)
```

### Precedence

A module theme is the **most specific** escape hatch, so it is registered
**last** and overrides built-in / config / `themesFile` themes of the same name.
The single-theme name resolves as: the module's own `name` export →
`theme.moduleThemeName` → `"custom"`.

### Failure is always a safe no-op

If `moduleUrl` is unset (the default), nothing is imported. If the import fails
for **any** reason — network/404, wrong MIME type, parse error, or a module that
doesn't export a usable Theme/BrandVariants — kbexplorer logs a single
`[themeModule]` warning and leaves the theme map unchanged. The app never breaks.

### ⚠️ Security & CSP implications (read before enabling)

Dynamically `import()`ing host-provided JavaScript **executes arbitrary code in
the page**, with the same privileges as kbexplorer itself (DOM access, network,
`localStorage`, etc.). Treat `moduleUrl` like any other script you add to your
site:

- **Off by default, explicit opt-in.** The field is unset out of the box; only a
  deliberate config edit turns it on.
- **Only point it at code you trust.** Prefer **self-hosting the module in the
  same repo** that already serves your content. Avoid third-party/CDN URLs you
  don't control — a compromised module can run anything.
- **How a repo-relative path resolves (this affects your CSP).** A repo-relative
  `moduleUrl` is resolved with the same helper as other host assets, and that
  differs by mode:
  - **Local / dev mode** (`VITE_KB_LOCAL=true` or `vite dev`): resolved to a
    **same-origin** path under your deploy base (e.g. `/theme/my-theme.js`).
  - **Remote mode** (the default, fetching from GitHub at runtime): resolved to a
    **cross-origin raw GitHub URL**, i.e.
    `https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>` (or your
    GitHub Enterprise raw/contents host). It is **not** same-origin even though it
    lives in "your" repo.
- **Content Security Policy.** If you serve kbexplorer with a CSP, the dynamic
  import must be allowed by **`script-src`** (the origin the module is served
  from), and fetching a cross-origin module additionally needs **`connect-src`**
  to permit the request. Concretely:
  - **Local/dev mode** — a same-origin module works under a strict
    `script-src 'self'` (and `connect-src 'self'`).
  - **Remote mode** — `'self'` is **NOT** sufficient. You must explicitly allow
    the raw host in BOTH directives, e.g.
    `script-src 'self' https://raw.githubusercontent.com;`
    `connect-src 'self' https://raw.githubusercontent.com;` (substitute your
    GitHub Enterprise raw host if applicable).
  - An absolute `https://other.example/…` `moduleUrl` likewise requires that
    origin in `script-src`/`connect-src`.
  - `'unsafe-eval'` is **not** required in any mode.
- **MIME type.** The module must be served with a JavaScript MIME type
  (`text/javascript` / `application/javascript`). `raw.githubusercontent.com`
  serves files as `text/plain`, so a repo-relative `moduleUrl` will typically
  **fail to import in remote mode** (a safe no-op + one warning). To use a custom
  JS theme module in remote mode, host it somewhere that serves a JS MIME type and
  reference it as an absolute URL (and allow that origin in your CSP).
- **No secrets.** The module is fetched by the browser like any static asset; do
  not embed credentials in it.

If you only need to recolor tokens or define named theme variants, prefer the
non-executable escape hatches instead: inline `theme.brand`/`theme.tokens`/
`theme.themes`, a YAML `theme.themesFile` (T5.1), or a raw CSS sheet via
`branding.css` (T5.2). Reach for `theme.moduleUrl` only when you need full
programmatic control.

## Environment Variables

These Vite env vars override config values at build/dev time:

| Variable | Purpose | Example |
|----------|---------|---------|
| `VITE_KB_OWNER` | GitHub owner | `my-org` |
| `VITE_KB_REPO` | GitHub repo name | `my-project` |
| `VITE_KB_BRANCH` | Target branch | `main` |
| `VITE_KB_PATH` | Content directory | `content` |
| `VITE_KB_TITLE` | Page title | `My KB` |
| `VITE_BASE_PATH` | Deployment base path | `/docs/kb/` |
| `VITE_ENV_DIR` | Directory to load .env from | `../../` |

These are typically set in `.env.kbexplorer` by the init script.
