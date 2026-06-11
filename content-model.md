# Xbox Personalization — Content Model & Files-to-Graph Pipeline

> Authoritative description of the entity content model used by this repo and how the per-entity files on disk get turned into the knowledge-graph artifact the KB Explorer (and any future consumer) renders.
>
> Captures the state of branch `hsomu-microsoft/graph-as-navigation` (PR #159) at HEAD `29dd00a2`, after rebase onto the Multi-Org Digital Twin base (PR #155, `dc36fb65`).

> [!NOTE]
> **Historical / upstream reference — not a literal spec of this repo's shipped sample.**
> This document mirrors the content-model spec from the upstream (now sunsetting)
> source repo and uses *its* layout and field names: a root-level `/teamops.yaml`,
> a `/schema/` tree, and identity keys `scheme` / `org` / `passthrough_schemes`.
> The **shipped, runnable sample in this template** lives under
> [`content-model/`](content-model/), and the **implemented parser**
> ([`src/engine/content-model/schema-reader.ts`](src/engine/content-model/schema-reader.ts))
> diverges from the text below in two load-bearing ways:
>
> - Identity is read as `identity.authority` + `identity.defaultOrg` (with
>   `identity.org` as a fallback), **not** `identity.scheme` / `identity.org` /
>   `passthrough_schemes`.
> - Every `kg://` URN base is derived from the `@context` in
>   [`content-model/index/context.jsonld`](content-model/index/context.jsonld),
>   **not** from a `scheme` / `passthrough_schemes` block in `teamops.yaml`.
>
> For the authoritative, implemented contract see
> [`src/engine/content-model/README.md`](src/engine/content-model/README.md).
> Treat the paths and field names below as illustrative of the model's *shape*,
> not as literal paths or keys in this repository.

---

## 1. Three layers, one identity

Everything in the content model breaks down into three layers stacked on top of each other:

| Layer | Lives in | What it is |
|---|---|---|
| **Identity** | `/teamops.yaml` | Single line — `identity: { scheme: kg, authority: xbox.com, org: personalization }` — that anchors every `kg://` URN this repo emits. |
| **Shape** | `/schema/` (`conventions.yaml`, `edges.yaml`, `lifecycle.yaml`, `entities/*.schema.json`) | The data model itself — kinds, fields, edges, lifecycle bands, where each kind lives on disk, what its URN looks like. |
| **Content** | `/priorities`, `/workstreams`, `/squads`, `/missions`, `/orgs`, `/people`, `/cycles`, ... | The actual entity instances (YAML/JSON), one file per entity (except `person`, which is roster-loaded). |

The single contract between the three layers is the `kg://` URN. Every entity instance has one. Files map to URNs. URNs are the node IDs in the graph. The kind of an entity lives on the resource as `rdf:type` (`@type` in JSON-LD); the system **never** infers kind from the URN path — paths are opaque hierarchy.

---

## 2. Identity — `/teamops.yaml`

```yaml
identity:
  scheme: kg              # native KG scheme; the only one supported
  authority: xbox.com     # the URN authority — not a DNS hostname, an identifier
  org: personalization    # injected between <kind-path> and <id> for org-scoped kinds
  passthrough_schemes:    # URLs that ARE the URN (no rewriting)
    - https
    - http
```

This is the only fixed path the platform depends on. Two URN shapes fall out of it:

- **Authority-scoped**: `kg://xbox.com/<kind-path>/<id>` — cross-org by design (org, person, cycle, entity-schema, github-issue, github-pr)
- **Org-scoped**: `kg://xbox.com/<kind-path>/personalization/<id>` — owned by an org (priority, workstream, squad, mission, decision, contract, surface, notes-blob, org-change, workstream-cycle, cycle-review)

The `<kind-path>` segment comes from `schema/conventions.yaml#storage.<kind>.path`. The `personalization` segment comes from `identity.org` here. A second org adopting this platform changes one line in this file (or runs in its own fork) — *not* every schema file.

### Passthrough URNs

GitHub issues and PRs use their dereferenceable HTTPS URL as their URN — there's no synthetic `kg://` for them. Declared in `schema/conventions.yaml`:

```yaml
github-issue:
  pattern: 'github/issues/<id>.yaml'
  passthrough:
    url_template: 'https://github.com/{owner}/{repo}/issues/{id}'
    owner: gaming-microsoft
    repo: Xbox-Personalization
```

So a GitHub PR's URN is just `https://github.com/gaming-microsoft/Xbox-Personalization/pull/159` — first-class in the graph, no special handling.

---

## 3. Shape

### 3.1 `schema/conventions.yaml` — where entities live on disk

For each kind:

| Field | Meaning |
|---|---|
| `pattern` | Filesystem path pattern (e.g. `squads/<id>.yaml`, `missions/<cycle>/<squad>.yaml`) |
| `path` | URN path segment after the authority (defaults to plural kind, e.g. `squads`) |
| `org-scoped` | If `true`, the URN-builder injects `identity.org` between `path` and the id |
| `companion` | Optional sibling files (`.md` prose expansion of the YAML — YAML is canonical) |
| `passthrough` | Optional — URL becomes the URN (GitHub issue/PR) |

The 16 kinds and where they sit:

| Kind | Disk pattern | Org-scoped | Lifecycle | URN example |
|---|---|---|---|---|
| `priority` | `priorities/<id>.yaml` | yes | durable | `kg://xbox.com/priorities/personalization/sp1-modern-personalized-experiences` |
| `org` | `orgs/<slug>.yaml` | no | durable | `kg://xbox.com/orgs/personalization` |
| `workstream` | `workstreams/<id>.yaml` | yes | durable | `kg://xbox.com/workstreams/personalization/discovery` |
| `squad` | `squads/<id>.yaml` | yes | durable | `kg://xbox.com/squads/personalization/game-assist` |
| `surface` | `surfaces/<id>.yaml` | yes | durable (PROPOSED) | `kg://xbox.com/surfaces/personalization/<id>` |
| `notes-blob` | `notes-blobs/<id>.yaml` | yes | durable | `kg://xbox.com/notes-blobs/personalization/<id>` |
| `person` | `people/chart-data.json` + `people/people.json` | no | durable | `kg://xbox.com/people/<alias>` |
| `cycle` | `cycles/<id>.yaml` | no | per-cycle | `kg://xbox.com/cycles/2026-C1` |
| `workstream-cycle` | `workstream-cycles/<cycle>/<workstream>.yaml` | yes | per-cycle | `kg://xbox.com/workstream-cycles/personalization/2026-C1:discovery` |
| `mission` | `missions/<cycle>/<squad>.yaml` | yes | per-cycle | `kg://xbox.com/missions/personalization/2026-C1:game-assist` |
| `decision` | `decisions/<cycle>/<squad>/<id>.yaml` | yes | per-event | `kg://xbox.com/decisions/personalization/2026-C1:game-assist:<id>` |
| `contract` | `contracts/<cycle>/<id>.yaml` | yes | per-event | `kg://xbox.com/contracts/personalization/2026-C1:<id>` |
| `cycle-review` | `cycle-reviews/<cycle>/<workstream>.yaml` | yes | per-event | `kg://xbox.com/cycle-reviews/personalization/2026-C1:discovery` |
| `org-change` | `org-changes/<id>.yaml` | yes | per-event | `kg://xbox.com/org-changes/personalization/<id>` |
| `github-issue` | `github/issues/<id>.yaml` | (passthrough) | per-event | `https://github.com/.../issues/<id>` |
| `github-pr` | `github/prs/<id>.yaml` | (passthrough) | per-event | `https://github.com/.../pull/<id>` |
| `entity-schema` | `schema/entities/<id>.schema.json` | no | durable | `kg://xbox.com/schemas/<kind>` |

Notice a few quirks worth flagging because they recur:

- **Composite IDs**: missions, workstream-cycles, decisions, contracts, cycle-reviews use composite IDs (`<cycle>:<squad>`, etc.). The storage hierarchy is preserved verbatim in the URN path.
- **Org file vs. org id**: an org's file may carry a broader slug (`orgs/xbox-personalization.yaml`) while the canonical `id` in the file is short (`personalization`). The id is what shows up in URNs.
- **Workstream voice content**: `workstreams/1-discovery.md` etc. are *not* Workstream entity instances. They're voice-content markdown consumed by `website/lib/voiceContent.ts`. YAMLs and voice markdown share the folder, distinguished by extension.
- **Mission companions**: `missions/<cycle>/<squad>/one-pager.md`, `decisions/<id>.md`, `contracts/<id>.md` are prose expansions of the YAML — YAML is canonical.
- **People is read-only**: from this schema's POV. The roster is regenerated by `tools/fetch-people.ps1` (Graph snapshot → `people.json`) and `tools/build-chart.ps1` (→ `chart-data.json` + `chart.html`). Source of structural changes is the hand-edited `people/org-chart.txt`.

### 3.2 Multi-org content layout (PR #155 effect)

The repo is a multi-org digital twin. The *default* org (`personalization`) keeps its content FLAT under each kind root:

```
squads/game-assist.yaml         →  kg://xbox.com/squads/personalization/game-assist
priorities/sp1-...yaml          →  kg://xbox.com/priorities/personalization/sp1-...
```

Non-default (test/fictitious) orgs nest content under a per-org subdir whose name is the org's `path` (fallback `id`):

```
squads/contoso/<id>.yaml        →  kg://xbox.com/squads/contoso/<id>
workstreams/fabrikam/<id>.yaml  →  kg://xbox.com/workstreams/fabrikam/<id>
```

The active org's content is *not* nested; everyone else's content *is*. This is what lets the same id (`personalization-algos` say) exist in two orgs without collision.

Fictitious orgs (`contoso`, `fabrikam`, `northwind-traders`, `tailspin-toys`) are flagged `fictitious: true` in their `orgs/<slug>.yaml`. They're hidden from the website by default; toggled via the `INCLUDE_FICTITIOUS=1` env var for validators/map generators, and a runtime "Show test orgs" UI flag for the explorer.

### 3.3 `schema/lifecycle.yaml` — three bands

| Band | Entities | Rule |
|---|---|---|
| `durable` | priority, org, workstream, squad, notes-blob, surface, person | Lives across cycles. MUST NOT carry a `cycle` field. |
| `per-cycle` | cycle, workstream-cycle, mission | One per (something + cycle). MUST carry a typed `cycle` FK. |
| `per-event` | decision, contract, cycle-review | One per artifact. MUST carry a typed `cycle` FK + a typed parent FK. |

The bands are enforced uniformly by the validator. Rule of thumb: **edits to durable entities record changes to that entity's own identity; alignment shifts (which priority a workstream serves this cycle, who's DRI right now) live on per-cycle entities.**

### 3.4 `schema/entities/*.schema.json` — field-level shape

Standard JSON Schema (Draft 2020-12) per kind. Each instance carries `rdf:type` whose CURIE expands to the schema URN — e.g. a Squad's `"@type": ["Squad"]` expands to `kg://xbox.com/schemas/squad`.

Highlights of the spine entities:

- **`org`**: `id`, `name`, optional `domain`, `path`, `leader` (alias FK → person), `parent` (FK → org), `mission`, `fictitious`. That's it. Lightweight container.
- **`workstream`**: `id`, `name`, `description`. `dri` is on its way out (per-cycle DRI should live on `workstream-cycle`). Six workstreams today: Discovery, Search, Gameplay Understanding & Experiences, ML Platform, AI Acceleration, Dev Platform.
- **`squad`**: durable identity inside a workstream. `id`, `name`, `workstreamId` (FK → workstream), `dri` + `pmAlias`, `knowledgeAreas[]`, `people[]`, `references[]`. Per-cycle data (DRI, members, mission, RAG) is supposed to migrate fully to `mission`; the legacy inline `workstream` object coexists with `workstreamId` mid-migration.
- **`mission`**: the richest entity. One squad's commitment for one cycle. Carries `cycle` + `squad` (composite key), `status`, `dri` (canonical per-cycle DRI), `mission`, `primaryPriorityId`, `secondaryPriorityIds[]`, `northStarMetric`, `supportingMetrics[]`, `people[]`, `milestones[]`, `tasks[]`, `rag`, plus inline `decisions[]` and `contracts[]` companion lists.
- **`priority`**: `id`, `name`, `description`, optional `orgId` (which team owns it), legacy `workstreamIds[]` (deprecated — derived from `mission.primaryPriorityId` aggregated per cycle).
- **`person`**: read-only here, sourced from the roster.

### 3.5 `schema/edges.yaml` — the cross-entity manifest

JSON Schema can describe a field but not what a field *means as a relationship*. `edges.yaml` is the authoritative manifest of the edges between entities:

```yaml
- name: squad-workstream
  from: { entity: squad, field: workstreamId }
  to:   { entity: workstream, field: id }
  cardinality: many-to-one
  lifecycle: durable
  required: true
```

Edges come in five resolution flavors:

| Flavor | Example | Notes |
|---|---|---|
| **Scalar FK** | `squad.workstreamId → workstream.id` | The most common shape |
| **Array FK** | `mission.secondaryPriorityIds[] → priority.id` | Each element resolves to its own edge |
| **Composite FK** | `workstream-cycle.missionIds[] → mission "<cycle>:<squad>"` | Target key has structure |
| **Alias FK** | `squad.dri → person.alias`, `org.leader → person.alias`, `*.people[].alias` | Every alias-shaped field points at Person; collected in the `alias-fk` class edge |
| **Derived** | `workstream-priority-alignment`, `mission-workstream` | Computed at build time from other edges; **not stored** |

Edges also carry `lifecycle` (matches the entity bands), `required`, and optional `deprecated: true` (kept for back-compat).

In plain English the spine is:

- A Workstream has many Squads; a Squad has one Workstream.
- A Squad has many Missions (one per cycle).
- A Mission has one primary Priority and zero+ secondary Priorities.
- A Workstream serves many Priorities (per cycle); a Priority is served by many Workstreams (per cycle). The link lives on Mission and is **derived** at the workstream level.
- A Cycle has many WorkstreamCycles (one per workstream) and many Missions (one per active squad).
- Person is leaf; everything else points at Person via alias.

### 3.6 `index/context.jsonld` — the CURIE table

The JSON-LD context that resolves CURIEs to URNs. Read by every loader and by the graph builder:

```json
{
  "@context": {
    "Squad":      { "@id": "kg://xbox.com/schemas/squad" },
    "Workstream": { "@id": "kg://xbox.com/schemas/workstream" },
    "Mission":    { "@id": "kg://xbox.com/schemas/mission" },
    "squad":      "kg://xbox.com/squads/personalization/",
    "workstream": "kg://xbox.com/workstreams/personalization/",
    "mission":    "kg://xbox.com/missions/personalization/",
    "person":     "kg://xbox.com/people/",
    "org":        "kg://xbox.com/orgs/",
    ...
  }
}
```

Two CURIE shapes:

- **Type CURIEs** (`Squad`, `Workstream`, ...): the schema URN. Used as `@type` on instances.
- **Instance prefix CURIEs** (`squad`, `mission`, ...): the URN base. `squad:game-assist` expands to `kg://xbox.com/squads/personalization/game-assist`.

`@vocab: kg://xbox.com/vocab#` is the namespace for any predicate name without an explicit CURIE.

This file is the **authoritative** CURIE table. The graph builder reads it; nothing hardcodes URN bases.

---

## 4. Content — the entity instances

Now to the actual files. The dominant pattern is **one file per entity**, YAML, hand-edited (or editor-edited via the website's entity editors), validated against its kind's schema, and resolved via `kg://` URNs.

A complete cycle's worth of content typically looks like:

```
orgs/
  personalization.yaml                                  # 1 org file
  contoso.yaml fabrikam.yaml ...                        # fictitious orgs

priorities/
  sp1-modern-personalized-experiences.yaml              # ~3 priorities per FY
  sp2-ai-native-platform.yaml
  sp3-ai-frontier.yaml
  1-modern-personalized-experiences.md                  # voice content
  contoso/  fabrikam/  ...                              # fictitious-org subdirs

workstreams/
  discovery.yaml search.yaml ml-platform.yaml ...       # 6 workstreams
  1-discovery.md 2-search.md ...                        # voice content
  contoso/  fabrikam/  ...

squads/
  game-assist.yaml game-journal.yaml ...                # ~14 squads
  contoso/  fabrikam/  ...

missions/
  2026-C1/
    game-assist.yaml                                    # one per (cycle, squad)
    game-assist/
      one-pager.md                                      # prose expansion
      decisions/<id>.md
      contracts/<id>.md

cycles/                                                 # cycle metadata
workstream-cycles/                                      # per-cycle WS rollup
decisions/  contracts/  cycle-reviews/                  # per-event entities

people/
  chart-data.json                                       # roster (generated)
  people.json                                           # flat roster (generated)
  org-chart.txt                                         # canonical source (hand-edited)
  photos/<alias>.jpg

orgs/xbox-personalization/                              # org-specific docs (non-canonical)
```

---

## 5. From files to graph — `tools/build-kb-graph.mjs`

This is the pipeline that turns the files above into `website/lib/__generated__/kb/graph.json` (+ `website/public/kb/graph.json` for client fetch), the single static graph artifact every frontend consumes.

### 5.1 Inputs

```
/teamops.yaml                  → identity.authority + identity.org
/index/context.jsonld          → CURIE prefix → URN base
/schema/edges.yaml             → cross-entity edge manifest
/schema/lifecycle.yaml         → durable | per-cycle | per-event bands
/priorities, /workstreams,
/squads, /missions, /orgs,
/cycles, /workstream-cycles,
/decisions, /contracts,
/cycle-reviews, /surfaces      → entity YAML files (multi-org tree)
/people/chart-data.json        → person roster
/people/photos/<alias>.jpg     → photo presence (used to gate node images)
```

### 5.2 Five passes

**Pass 1 — Discovery.** Walk each kind's `root` (from `KINDS` registry inside the builder, e.g. `priorities/`, `workstreams/`, `squads/...`). For each YAML found, determine its **org**:

- If the path is `<root>/<orgPath>/...` and `<orgPath>` matches a non-default org's `path` (from `orgs/*.yaml`), that's the org.
- Otherwise it's the default org (`personalization`).
- Authority-scoped kinds (org, person, cycle) ignore org entirely.

For each entity build a node `{ id (CURIE), kind, org, urn, title, summary, lifecycle, fictitious, ...kindFields }` and bucket it into a `(kind, org, id)` index.

**Pass 2 — Synthetic home node.** The KB Explorer's root (`/`) needs an entry point. The builder mints a single well-known node `home:xbox-personalization` framed as the whole company (Xbox), with a derived `home → person:ashasharma` edge (the CEO at the top of the org chart). This is a hardcoded convention in the builder, not file-backed config.

**Pass 3 — Edge resolution.** Walk `edges.yaml`. For each edge:

- **Scalar FK**: read `from.entity.from.field`, look up the target in the `(kind, org, id)` index, emit an edge `{from-urn → to-urn, type, label}`.
- **Array FK**: same, but iterate.
- **Composite FK**: split on `:`, resolve.
- **Alias FK class**: for each kind in `ALIAS_FIELDS`, scan the kind's alias-shaped fields (`dri`, `ownerAlias`, `people[].alias`, `milestones[].ownerAlias`, ...), look up Person by alias, emit edge with role label (`DRI`, `Owner`, `Member`, `Decider`, ...).
- **Derived**: compute (e.g. workstream-priority alignment = aggregate `mission.primaryPriorityId` by `(cycle, workstream)`).
- **Skipped**: edges marked `deprecated: true` may still emit but typed `deprecated` so the UI can dim them.

Unresolved targets (e.g. a mission points at a cycle that has no `cycles/2026-C1.yaml`) become **stub nodes** — lightweight placeholders so the graph stays connected and every CURIE is addressable.

**Pass 4 — Edge typing & roles.** Each edge gets a `relation` from a small taxonomy:

| Relation | Meaning |
|---|---|
| `leads` | DRI / Owner / Lead / Author — accountable owner |
| `staffs` | Member / Contributor / Decider — participates in |
| `reports-to` | Manager ↔ direct report (from the Person roster) |
| `structural` | Containment / FK spine (e.g. squad → workstream) |
| `derived` | Inferred alignment — computed, not authored |
| `deprecated` | Kept for history; superseded |

This is what the explorer renders in the legend — six legible relationship types over the dozens of raw edges in `edges.yaml`.

**Pass 5 — Cluster assignment.** Each node gets a `cluster` (== its kind) with a palette colour. The palette lives in the builder so the JSON is presentation-light; the UI maps cluster → icon separately. Today's clusters: `home`, `priority`, `workstream`, `workstreamCycle`, `squad`, `mission`, `cycle`, `decision`, `contract`, `cycleReview`, `org`, `surface`, `person`.

### 5.3 Outputs

Two byte-identical files:

```
website/lib/__generated__/kb/graph.json      # canonical (RSC, tests)
website/public/kb/graph.json                 # client fetch target
```

Shape (truncated, real keys):

```json
{
  "context": { "@vocab": "kg://xbox.com/vocab#", ... },
  "clusters": [ { "id": "squad", "label": "Squads", "color": "#8CB050" }, ... ],
  "relations": [ { "id": "leads", "label": "Leads / DRI", "description": "..." }, ... ],
  "nodes": [
    {
      "id": "squad:game-assist",
      "urn": "kg://xbox.com/squads/personalization/game-assist",
      "kind": "squad",
      "org": "personalization",
      "cluster": "squad",
      "title": "Game Assist",
      "summary": "Discovery",
      "lifecycle": "durable",
      "fictitious": false,
      "href": "/squads/game-assist",
      "fields": { ... select fields for tile rendering ... }
    },
    ...
  ],
  "edges": [
    {
      "from": "squad:game-assist",
      "to": "workstream:discovery",
      "type": "squad-workstream",
      "relation": "structural",
      "label": null
    },
    {
      "from": "squad:game-assist",
      "to": "person:fkardar",
      "type": "alias-fk",
      "relation": "leads",
      "label": "DRI"
    },
    ...
  ],
  "diagnostics": [ ... unresolved-target warnings, never hard failures ... ]
}
```

### 5.4 Drift control

The builder accepts `--check`: it re-runs in memory and diffs against the committed `graph.json`, exiting non-zero on drift. CI runs this on every PR — a stale committed graph fails the build. Mirrors the pattern used by `build-views.mjs`.

### 5.5 What it deliberately doesn't do

- **Doesn't infer kind from URN path.** Kind is always read from the resource's `rdf:type` (or, for files, from which `KINDS` root contains the file). Paths are opaque hierarchy.
- **Doesn't store derived edges twice.** The derived `workstream-priority-alignment` is recomputed; it isn't held on either Workstream or Priority.
- **Doesn't bake org segments into per-kind paths.** Org-scoping is one flag on a kind plus one line in `/teamops.yaml`. Another org adopting this platform changes that one line and gets correct URNs everywhere.

---

## 6. How consumers use the graph

Two consumers exist today:

1. **The website's KB Explorer** (`website/components/kb-explorer/*`, currently in flux — see PR #159) — fetches `/kb/graph.json` at runtime, renders nodes/edges with the cluster palette + relation legend.
2. **Build-time route manifest** (`tools/build-kb-graph.mjs` also emits a route manifest read by `website/lib/kb/routes.ts`) — turns the URN graph into the flat-route map (`/<kind>/<id>`, `/<org>/<kind>/<id>`) used by the entity editor.

But the contract is: **anything that can read JSON and understand the JSON-LD `@context` can consume the graph.** The `kbexplorer-template` reference UI, a Power BI report, a CLI inspector, a fresh React SPA — any of them can adopt this artifact without touching the source files.

That's the point of the model: the files-to-graph pipeline is the boundary. Above the boundary, content. Below, anyone.

---

## 7. Open questions captured in the schema

The schema files carry their own open-question lists; called out here for visibility:

- **`cycle-id` format**: `2026-C1` (mission-templates branch) vs `FY26C0` (Cycles/ folder). Both in the repo; pick one and migrate.
- **`workstream/<n>-<slug>.md` coexistence**: voice content shares the folder with entity YAML. Acceptable, or move voice to `content/workstreams/`?
- **`cycle-review` → fold into `workstream-cycle`?** (LT decision #2)
- **`surface` kind**: PROPOSED, folder doesn't exist yet. (LT decision #3)
- **`workstream-cycle.missionIds[]`**: stored today, should be derivable from `mission-workstream + mission-cycle`.
- **`squad.dri` vs `mission.dri`**: duplicated; treat squad-level dri as derived "most-recent" view.
- **`mission.primaryPriorityId`**: PROPOSED. Once shipped, retire `priority.workstreamIds[]`.

---

## 8. Quick reference — kind, file, URN, lifecycle

| Kind | File | URN | Lifecycle |
|---|---|---|---|
| org | `orgs/<slug>.yaml` | `kg://xbox.com/orgs/<id>` | durable |
| priority | `priorities/<id>.yaml` | `kg://xbox.com/priorities/personalization/<id>` | durable |
| workstream | `workstreams/<id>.yaml` | `kg://xbox.com/workstreams/personalization/<id>` | durable |
| squad | `squads/<id>.yaml` | `kg://xbox.com/squads/personalization/<id>` | durable |
| surface | `surfaces/<id>.yaml` *(proposed)* | `kg://xbox.com/surfaces/personalization/<id>` | durable |
| notes-blob | `notes-blobs/<id>.yaml` | `kg://xbox.com/notes-blobs/personalization/<id>` | durable |
| person | `people/chart-data.json` | `kg://xbox.com/people/<alias>` | durable |
| cycle | `cycles/<id>.yaml` | `kg://xbox.com/cycles/<id>` | per-cycle |
| workstream-cycle | `workstream-cycles/<cycle>/<workstream>.yaml` | `kg://xbox.com/workstream-cycles/personalization/<cycle>:<workstream>` | per-cycle |
| mission | `missions/<cycle>/<squad>.yaml` | `kg://xbox.com/missions/personalization/<cycle>:<squad>` | per-cycle |
| decision | `decisions/<cycle>/<squad>/<id>.yaml` | `kg://xbox.com/decisions/personalization/<cycle>:<squad>:<id>` | per-event |
| contract | `contracts/<cycle>/<id>.yaml` | `kg://xbox.com/contracts/personalization/<cycle>:<id>` | per-event |
| cycle-review | `cycle-reviews/<cycle>/<workstream>.yaml` | `kg://xbox.com/cycle-reviews/personalization/<cycle>:<workstream>` | per-event |
| org-change | `org-changes/<id>.yaml` | `kg://xbox.com/org-changes/personalization/<id>` | per-event |
| github-issue | `github/issues/<id>.yaml` | `https://github.com/<owner>/<repo>/issues/<id>` *(passthrough)* | per-event |
| github-pr | `github/prs/<id>.yaml` | `https://github.com/<owner>/<repo>/pull/<id>` *(passthrough)* | per-event |
| entity-schema | `schema/entities/<id>.schema.json` | `kg://xbox.com/schemas/<id>` | durable |

---

## 9. The contract at a glance

```
┌─────────────────┐     ┌─────────────────┐     ┌────────────────────────┐
│  /teamops.yaml  │     │   /schema/      │     │  Entity instances      │
│  identity       │ ──> │   conventions   │ ──> │  priorities/*.yaml     │
│  • authority    │     │   edges         │     │  squads/*.yaml         │
│  • org          │     │   lifecycle     │     │  missions/<c>/<s>.yaml │
└─────────────────┘     │   entities/     │     │  ...                   │
                        └─────────────────┘     └────────────────────────┘
                                                            │
                                                            ▼
                                         ┌──────────────────────────────────┐
                                         │  tools/build-kb-graph.mjs        │
                                         │  • discover by walking kind roots│
                                         │  • build (kind,org,id) index     │
                                         │  • resolve edges.yaml            │
                                         │  • derive computed edges         │
                                         │  • assign clusters & relations   │
                                         │  • stub unresolved targets       │
                                         └──────────────────────────────────┘
                                                            │
                                                            ▼
                                         ┌──────────────────────────────────┐
                                         │  website/lib/__generated__/      │
                                         │      kb/graph.json   (canonical) │
                                         │  website/public/kb/graph.json    │
                                         │      (client fetch target)       │
                                         └──────────────────────────────────┘
                                                            │
                          ┌─────────────────────────────────┼─────────────────────────────────┐
                          ▼                                 ▼                                 ▼
                ┌──────────────────┐            ┌──────────────────────┐         ┌─────────────────────┐
                │  KB Explorer UI  │            │  Flat-route editor   │         │  Any 3rd consumer   │
                │  (in-website)    │            │  /<kind>/<id>        │         │  (kbexplorer-template,
                │                  │            │  /<org>/<kind>/<id>  │         │   Power BI, CLI, …) │
                └──────────────────┘            └──────────────────────┘         └─────────────────────┘
```

That's the whole model.
