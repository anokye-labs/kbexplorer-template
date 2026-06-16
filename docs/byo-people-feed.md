# BYO People Feed — `person` descriptor contract

> The supported **bring-your-own (BYO)** contract for supplying `person` nodes to the
> content-model engine. An external pipeline — e.g. a Microsoft Graph org snapshot
> plus announced-reorg deltas — can emit files that conform to this contract and they
> will pass validation and render in the bespoke [`PersonView`](../src/views/viewers/PersonView.tsx).
>
> Read alongside the [Work-Graph Vocabulary](work-graph-vocabulary.md) (the §2.4 `person`
> shape and §4 resolution rules) and the [content-model ingestion pipeline README](../src/engine/content-model/README.md).
>
> **Accuracy promise:** every field below is read by code in this repo. Do not invent
> fields — unknown keys are *carried through* verbatim (see §7) but are not interpreted.

---

## 1. What a feed supplies

The engine ingests **YAML entity files**, one per person, under the `person` kind's path
root. It does **not** ingest hand-authored JSON-LD documents directly: the walk pass only
picks up files matching `*.yaml` / `*.yml` (`builder.ts` → `walkEntities`). The JSON-LD
envelope (`@context` / `@id` / `@type`) is **derived by the engine** from each YAML record
(see §5). So a BYO pipeline produces YAML; the graph is the JSON-LD.

```
content-model/
  index/context.jsonld     # MUST contain a `person` URN base (see §3)
  schema/conventions.yaml   # declares the `person` kind (path: people, aliasField: alias)
  people/<id>.yaml          # one file per person — the BYO feed writes these
```

A person file lives at `content-model/people/<id>.yaml`. `person` is **authority-scoped**
(`orgScoped: false` in `conventions.yaml`), so the path is flat — there is no per-org
subdirectory for people, and the file location does **not** affect the person's identity.

---

## 2. Fields

A `person` record is a flat YAML mapping. `data` becomes the verbatim parsed record, so the
mapping is reversible and lossless.

### 2.1 Required fields

| Field | Type | Why required |
|---|---|---|
| `@type` | string | Must be `person` (or a vocabulary alias that resolves to `person` — see §6). Missing → `missing-type` warning and the file is **skipped** (no node). |
| `id` | string (slug) | The primary key. Forms the URN (`{base}{id}`) and is the lookup key for scalar/array FK references such as `manager`. Missing → `missing-id` warning and the file is **skipped**. |

> `name` is **strongly recommended** and is treated as required by the
> [vocabulary contract §2.4](work-graph-vocabulary.md#24-person). The engine itself falls
> back to `name ?? title ?? id` for the node title, and `PersonView` falls back to
> `node.title`, so an omitted `name` will not break ingestion — but the person will display
> as their `id`. A BYO feed should always supply `name`.

### 2.2 Optional fields read by `PersonView`

These are the fields the bespoke viewer renders. All are optional; absent fields are simply
not shown.

| Field | Type | Rendered as |
|---|---|---|
| `name` | string | The `<h2>` person name. |
| `role` | string | Sub-heading under the name. |
| `alias` | string | GitHub handle, shown as `@{alias}`. Also the FK target other entities use to reference this person (see §4). |
| `team` | string | A plain **"Team"** label. ⚠️ This is display text only — see §4.3. |
| `manager` | string (person `id`) | A **"Reports to"** row, and the source of the `reports-to` edge (see §4.1). |
| `email` | string | A `mailto:` link. |
| `knowledgeAreas` | string[] | A bulleted **"Knowledge areas"** list. Non-array values are ignored. |

### 2.3 Work-derived fields (do **not** author these)

`PersonView` also renders an **"Active work"** section from `login`, `activeIssues` and
`activePRs`. **A BYO feed must not supply these** — they are injected at graph-build time by
the [`PersonProvider`](../src/engine/providers/person-provider.ts) from live GitHub activity
(see §8). If you hand-write them they will simply be overwritten when the descriptor is
matched to a GitHub login, or render stale data if it is not.

| Field | Type | Source |
|---|---|---|
| `login` | string | The matched GitHub login (set by `PersonProvider`). |
| `activeIssues` | `{ number, title }[]` | Open issues the person authored/was assigned. |
| `activePRs` | `{ number, title }[]` | Open PRs the person authored/was assigned. |

---

## 3. `@type` / `id` / URN rules

- **`@type` must be `person`.** The kind is taken from `@type`, **never** from the file path
  (`conventions.yaml` → `typeField: "@type"`). A `@type` that is not `person` and has no
  vocabulary alias to `person` produces an `unknown-kind` warning and is skipped.
- **`id` is the slug** in the `id` field (`conventions.yaml` → `idField: id`). Keep it a
  stable, lowercase, URL-safe handle (e.g. `ada`, `kwame`).
- **URN:** because `person` is authority-scoped, the canonical identifier is
  `{base}{id}` where `{base}` is the `person` prefix from `index/context.jsonld`. With the
  template's context (`"person": "kg://xbox.com/people/"`), `id: ada` →
  `kg://xbox.com/people/ada`.
- **The `person` prefix MUST exist in `index/context.jsonld`.** URN bases come from the
  JSON-LD context **only** — they are never hardcoded. A missing `person` prefix produces a
  hard `unknown-prefix` **error** and the node is dropped. The BYO pipeline must guarantee
  the context declares `person`.
- `node.id === node.identity === <URN>`. The engine writes the reserved keys
  (`@context` / `@id` / `@type`) last when building the JSON-LD envelope, so nothing in a
  person's `data` can override them.

---

## 4. Reference semantics

### 4.1 `manager` → `reports-to` (scalar FK, resolved by `id`)

`person.manager` is a **scalar foreign key** (`schema/edges.yaml` → `person-manager`,
`fk: scalar`, `relation: reports-to`). Scalar FKs resolve against the `(kind, id)` index, so:

- **`manager` must hold the target person's `id`, not their `alias`.**
- A resolved `manager` emits a directed `reports-to` edge from this person to their manager.
- An **unresolved** `manager` (no person with that `id` in scope — e.g. a manager who is
  outside the snapshot, like a `cto` placeholder) creates a **stub node**
  (`data.unresolved = true`) and a `warn`-level `unresolved-ref` diagnostic. The graph stays
  connected; the validator lists every dangling reference. This is intentional and is the
  same behaviour as every other FK in the model — a reorg delta that names a not-yet-ingested
  manager degrades gracefully rather than failing the build.

> **Reorg deltas:** to re-parent a person, change their `manager` to the new manager's `id`.
> The `reports-to` edge is **derived, never stored** on the manager — you only edit the
> report's file, never the manager's.

### 4.2 `alias` — the inbound FK target

`alias` is the `aliasField` for `person` (`conventions.yaml`). It exists so **other** entities
can point at a person by their human handle via an **alias FK**:

- `team.lead` → person (`team-lead`, `fk: alias`, `relation: leads`)
- `squad.dri` → person (`squad-dri`, `fk: alias`, `relation: leads`)

Alias FKs resolve by the person's `alias`, **falling back to `id`** if no alias matches.
`team.members` / `squad.members` are **array FKs resolved by `id`**, not alias. Practical
guidance, mirroring the vocabulary contract: **keep `id === alias`** for new descriptors
unless the GitHub login genuinely differs from the slug. When the login differs (e.g.
`id: ada`, `alias: aokonkwo`), set `alias` to the **GitHub login** so live-work matching works
(see §8).

### 4.3 `team` is a label, not an edge

There is **no `person.team` edge** in `schema/edges.yaml`. The `team` field is rendered by
`PersonView` as a plain string only. Team membership is modelled in the **other** direction —
a `team` descriptor lists people in its `members` (array FK → `staffs`) and a person in its
`lead` (alias FK → `leads`). If a BYO feed wants graph edges between people and teams, it must
emit `team` descriptors whose `members` / `lead` reference person `id` / `alias`; setting
`team:` on the person alone produces a label but no relationship.

---

## 5. How derived JSON-LD is supplied

The feed supplies **YAML records**; the engine derives the JSON-LD. For each person file the
builder (`emitNode`) produces a `KBNode` whose `jsonld` envelope is:

```jsonc
{
  // ...verbatim person record fields (name, role, email, alias, manager, ...),
  "lifecycle": "durable",            // surfaced from lifecycle.yaml (person is durable)
  "@context": { /* from index/context.jsonld */ },
  "@id": "kg://xbox.com/people/<id>", // === identity URN
  "@type": "person"
}
```

Notes for a BYO pipeline:

- **You do not author `@context`, `@id`, `@type`, or `lifecycle` inside the JSON-LD** — they
  are computed. You only author the flat YAML record. `@type` and `id` in your YAML *drive*
  the envelope but the reserved LD keys are (re)written by the engine.
- The full JSON-LD `@context` is repo-wide and comes from `index/context.jsonld`. The BYO
  feed's responsibility is limited to ensuring the `person` prefix is present there (§3).
- `data` (the bag the viewers read) is the **verbatim** parsed record, so any extra fields you
  emit survive round-trip (§7) even though only the §2 fields are interpreted.

---

## 6. Vocabulary aliasing (optional)

If an upstream system calls a person something other than `person` (e.g. `employee`,
`contact`), the cross-repo synonym layer can map that term to the canonical `person` kind via
`index/vocabulary.jsonld`:

```jsonc
{ "@context": { "employee": "person" } }
```

A file with `@type: employee` then gets the `person` convention, URN base, cluster and viewer,
while `data['@type']` keeps the native term and the node surfaces `jsonld.nativeType`. This is
a strictly additive no-op when no vocabulary is declared. Prefer emitting `@type: person`
directly unless you must preserve an upstream label.

---

## 7. Provenance and stability

- **`sourceFile` provenance.** Every person node carries
  `sourceFile: { path, raw, format }` — the **repo-relative** path
  (`content-model/people/<id>.yaml`), the **verbatim** file text, and `format: 'yaml'`. This
  is what the in-app editor and the GitHub PR handoff use as the source of truth, so a BYO
  pipeline should:
  - write each person to a deterministic path `content-model/people/<id>.yaml` (one entity per
    file), and
  - keep the YAML human-diffable — the `raw` text is preserved byte-for-byte, so stable key
    ordering and minimal churn make reorg deltas reviewable.
- **`derived: true`.** Content-model nodes are flagged machine-derived, i.e. safe to
  regenerate from the feed. A re-run that re-emits the same records yields the same graph.
- **Open / passthrough fields.** Unknown YAML keys are copied verbatim into `data` and the
  JSON-LD body; they are not validated or interpreted. This lets a feed carry extra
  provenance (e.g. an upstream object id, a snapshot timestamp) without engine changes — but
  such fields will not render in `PersonView` unless a viewer is taught to read them.
- **Stable interpreted fields:** `@type`, `id`, `name`, `role`, `email`, `alias`, `manager`,
  `team`, `knowledgeAreas`. Treat these as the contract surface; everything else is opaque
  passthrough.

### Validation summary

A node is **valid and rendered** when it has `@type: person`, a non-empty `id`, and the
context declares the `person` prefix. The graph-validation gate surfaces these codes:

| Code | Level | When |
|---|---|---|
| `missing-type` | warn | no `@type` — file skipped |
| `missing-id` | warn | no `id` — file skipped |
| `unknown-kind` | warn | `@type` not a known kind / alias — file skipped |
| `unknown-prefix` | error | no `person` URN base in `index/context.jsonld` — node dropped |
| `unresolved-ref` | warn | `manager` (or inbound `lead`/`members`) names a person not in scope — stub node created |

---

## 8. Bridging to live GitHub work

A `person` descriptor and a **work-derived** person node are reconciled by the
[`PersonProvider`](../src/engine/providers/person-provider.ts), which runs after the content
model is built:

- It scans **open** issues and PRs and groups them by GitHub `login` (author or assignee).
- A login with at least `config.people.minActiveItems` (default `1`) active items qualifies.
- If a content-model `person` descriptor exists whose **`alias` (or `id`) equals that login**
  (case-insensitive), the work-derived node is **suppressed** and the descriptor is enriched
  in place with `login`, `activeIssues`, `activePRs` and `assigned-to` / `authored` edges to
  those items — which is exactly what powers `PersonView`'s "Active work" section.
- If no descriptor matches, the provider mints a standalone work-derived `person` node
  (`id: person-<login>`, identity `urn:person:<login>`).

**Implication for the BYO feed:** to attach a snapshot person to their live GitHub activity,
set the person's `alias` to their **GitHub login**. With `id === alias === login` the
descriptor both renders cleanly and absorbs live work. If the org login differs from your
chosen slug, keep `id` as the slug and put the login in `alias`.

---

## 9. Worked example

```yaml
# content-model/people/ada.yaml
"@type": person
id: ada                 # slug → URN kg://xbox.com/people/ada
alias: aokonkwo         # GitHub login → live-work bridge + inbound alias-FK target
name: Ada Okonkwo
role: Engineering Lead
email: ada@example.com
manager: kwame          # person *id* → reports-to edge (stub if kwame absent)
knowledgeAreas:
  - graph engines
  - TypeScript
```

This yields a `person` node with identity `kg://xbox.com/people/ada`, a `reports-to` edge to
`kg://xbox.com/people/kwame` (or a stub if Kwame is outside the snapshot), and — if the
GitHub login `aokonkwo` has open issues/PRs — an enriched "Active work" section.
