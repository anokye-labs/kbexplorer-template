# Compatibility Matrix & Release Pinning

This document defines how **kbexplorer-template** releases line up with the
**kbexplorer CLI** (`anokye-labs/kbexplorer`), and the contract a host repository
follows when it vendors the template.

> **TL;DR** — Vendor the template at an **immutable tag** (`vX.Y.Z`), not a moving
> branch. A tag-pinned install is reproducible and is treated as **satisfied** by
> `kbexplorer doctor` (no branch-tracking warning).

---

## Template ↔ CLI compatibility matrix

| Template tag | Status      | Compatible kbexplorer CLI | Notes |
|--------------|-------------|---------------------------|-------|
| `v0.2.0`     | **Current** | `>= 0.1.0`                | Adds release pinning, CHANGELOG, this matrix. Recommended for new installs. |
| `v0.1.0`     | Superseded  | `>= 0.1.0`                | Initial template release. Immutable; not re-pointed. |

Compatibility is expressed against the CLI's published releases. Within a `0.x`
line, patch/minor CLI releases are expected to remain compatible; a new template
**minor** (e.g. `0.2 → 0.3`) is the signal to re-check this table before upgrading.

When in doubt, pin **both** sides:

- the template, to a tag in the table above, and
- the CLI, to a released CLI tag (the CLI's `init --ref vX.Y.Z` selects it).

---

## The pinning contract

A *supported, reproducible* install of the template means a host repo references it
at an **immutable git tag**:

- **Submodule / vendor checkout** — add the dependency and check out a tag rather
  than leaving it on `main`:

  ```bash
  git submodule add https://github.com/anokye-labs/kbexplorer.git .kbexplorer
  git -C .kbexplorer checkout v0.2.0          # pin to an immutable tag
  git add .kbexplorer && git commit -m "chore: pin kbexplorer to v0.2.0"
  ```

- **CLI bootstrap** — the kbexplorer CLI selects the same ref at init time:

  ```bash
  kbexplorer init --ref v0.2.0
  ```

  > The `init --ref` resolution itself lives in the CLI repo; this template only
  > documents which tags are valid targets (see the matrix above).

Tracking a branch (`main`) instead of a tag is **not** reproducible: the upstream
ref moves, so two installs taken a day apart can render differently and cannot be
audited. That is precisely the situation `kbexplorer doctor` flags.

---

## How `kbexplorer doctor` treats a pinned install

`kbexplorer doctor` runs in the **host** repo and inspects how the template/CLI is
vendored. Its branch-tracking check resolves as follows:

| Vendored ref                          | doctor result | Guidance emitted |
|---------------------------------------|---------------|------------------|
| Immutable tag (`vX.Y.Z`)              | **Satisfied** | none — pinning requirement met |
| Detached HEAD at a tagged commit      | **Satisfied** | none |
| Moving branch (`main`, `master`, …)   | **Warning**   | *"Template tracks branch <name>; pin to a release tag for reproducible installs."* |

To clear the warning, move the vendored checkout from the branch onto a tag from
the matrix:

```bash
git -C .kbexplorer fetch --tags
git -C .kbexplorer checkout v0.2.0
git add .kbexplorer && git commit -m "chore: pin kbexplorer to v0.2.0"
```

After re-pinning, re-run `kbexplorer doctor`; the branch-tracking check reports
satisfied because the checkout now resolves to an immutable tag.

> The doctor command's source lives in the kbexplorer **CLI** repo. This document is
> the template-side half of that contract: it enumerates the tags doctor accepts as
> "pinned" and keeps the compatibility matrix authoritative.

---

## Cutting a new template release (maintainers)

Bumping `package.json` `version` is necessary but not sufficient — a release is only
reproducible once an **immutable tag and GitHub Release** exist. After the version
bump merges to `main`:

```bash
git checkout main && git pull
git tag -a v0.2.0 -m "v0.2.0 — release pinning, CHANGELOG, compatibility matrix"
git push origin v0.2.0
gh release create v0.2.0 \
  --repo anokye-labs/kbexplorer-template \
  --title "v0.2.0" \
  --notes-file <(sed -n '/^## \[0.2.0\]/,/^## \[0.1.0\]/p' CHANGELOG.md)
```

Then add the new tag to the [compatibility matrix](#template--cli-compatibility-matrix)
and the [`CHANGELOG.md`](../CHANGELOG.md) in the **next** change.
