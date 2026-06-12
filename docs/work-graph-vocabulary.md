# Work-Graph Vocabulary

> Authoritative contract for the five organizational-layer descriptor kinds introduced in [issue #233](https://github.com/anokye-labs/kbexplorer-template/issues/233).
> Consumers: host-repo YAML authors, the content-model engine (F2), and the in-app editor (F5 / PR #205).

---

## 1. Overview

The five descriptor kinds form the **organizational layer** of the work-graph — the persistent, durable backbone that contextualizes squads, missions, and priorities. Unlike per-cycle entities (missions, workstream-cycles) the descriptors are `durable`: they don't carry a `cycle` field and must not be regenerated per planning cycle.

| Kind | Path root | Org-scoped | Lifecycle |
|---|---|---|---|
| `team` | `teams/` | yes | durable |
| `workstream` | `workstreams/` | yes | durable |
| `priority` | `priorities/` | no | durable |
| `person` | `people/` | no | durable |
| `system-of-record` | `systems-of-record/` | no | durable |

> **Note:** `workstream` and `priority` already exist in the fixture spine. These descriptors follow the same shape for the template's own organizational layer — host repos pick whichever kinds they need.

---

## 2. YAML shapes

### 2.1 `team`

```yaml
# content-model/teams/<id>.yaml
"@type": team
id: graph-platform
name: Graph Platform
description: Owns the KB Explorer content-model pipeline and graph rendering.
members:
  - adwoa    # person ids (for staffs edges)
  - kwame
workstreams:
  - kb-explorer   # workstream ids (for owns edges)
lead: adwoa       # person id (alias field → leads edge)
```

**Required fields:** `@type`, `id`, `name`
**Optional fields:** `description`, `members` (array of person ids), `workstreams` (array of workstream ids), `lead` (person alias/id — selects the `leads` edge)

### 2.2 `workstream`

```yaml
# content-model/workstreams/<id>.yaml
"@type": workstream
id: kb-explorer
name: KB Explorer
description: Interactive knowledge graph explorer for work-graph sensemaking.
priority: p1            # priority id (for has-priority edge)
team: graph-platform    # team id (for structural/owns back-edge)
systems-of-record:
  - gh-repo             # system-of-record ids → tracked-in edges
  - ado-board
```

**Required fields:** `@type`, `id`, `name`
**Optional fields:** `description`, `priority` (priority id), `team` (team id), `systems-of-record` (inline list; see §2.5)

### 2.3 `priority`

```yaml
# content-model/priorities/<id>.yaml
"@type": priority
id: p1
name: P1 — Explorer Completeness
description: Make KB Explorer the canonical lens for work-graph sensemaking.
rank: 1
```

**Required fields:** `@type`, `id`, `name`
**Optional fields:** `description`, `rank` (integer, lower = higher priority)

### 2.4 `person`

```yaml
# content-model/people/<id>.yaml
"@type": person
id: adwoa
alias: adwoa          # alias used as the FK target in alias-FK edges
name: Adwoa Mensah
role: Engineering Lead
email: adwoa@example.com
manager: kwame        # person id → reports-to edge
```

**Required fields:** `@type`, `id`, `name`
**Optional fields:** `alias` (string — the alias handle referenced by `team.lead`, `team.members`), `role`, `email`, `manager` (person id → `reports-to` edge)

> `alias` is the aliasField for `person` in `conventions.yaml`. When both `id` and `alias` differ, alias-FK edges (e.g. `team.lead`) resolve via alias; id-FK edges (e.g. `team.members`) resolve via id. For simplicity, new descriptors should keep `id === alias`.

### 2.5 `system-of-record`

A system-of-record can appear as:

**Standalone file** (canonical form — shared SoR referenced across workstreams by id):
```yaml
# content-model/systems-of-record/<id>.yaml
"@type": system-of-record
id: ado-board
name: ADO Board
url: "https://dev.azure.com/anokye-labs/kbexplorer"
description: Primary planning and tracking board.
```

**Required fields:** `@type`, `id`, `name`
**Optional fields:** `url`, `description`

> A workstream references a system-of-record by id in its `systems-of-record` array. The engine resolves each id to a `system-of-record` node and emits a `tracked-in` edge. Unresolved ids (no matching standalone file) become stub nodes with a `warn`-level `unresolved-ref` diagnostic — the same behavior as all other dangling FK references.

---

## 3. Derived edges

The builder derives four edge types from the descriptor fields. These are FK edges declared in `schema/edges.yaml` and resolved by the existing engine; they are **not stored** on any entity.

| Edge id | From | Field | To | Relation | FK flavor |
|---|---|---|---|---|---|
| `team-lead` | `team` | `lead` | `person` | `leads` | alias |
| `team-members` | `team` | `members` | `person` | `staffs` | array |
| `team-workstreams` | `team` | `workstreams` | `workstream` | `owns` | array |
| `workstream-priority` | `workstream` | `priority` | `priority` | `has-priority` | scalar |
| `workstream-team` | `workstream` | `team` | `team` | `structural` | scalar |
| `workstream-sor` | `workstream` | `systems-of-record[*].id` | `system-of-record` | `tracked-in` | array |
| `person-manager` | `person` | `manager` | `person` | `reports-to` | scalar |

> `owns` and `has-priority` are new relation labels that flow into the open `KnownRelation` taxonomy. They render with distinct visual styles (see §6).

---

## 4. Reference resolution rules

1. **id resolution (scalar/array FK):** The engine looks up the target entity by its `id` field in the `(kind, id)` index.
2. **alias resolution (alias FK):** For `team.lead`, the engine looks up `person` by `alias`. If not found it falls back to `id`.
3. **Dangling references:** Any reference that cannot be resolved (no matching `id`/`alias` in scope) creates a **stub node** (`data.unresolved = true`) and pushes a `warn`-level diagnostic with code `unresolved-ref`. The graph stays connected; the validator reports every dangling ref. This is the same behavior as existing spine FK edges.
4. **Inline systems-of-record:** Inline `{ id, name, url }` entries on a workstream do NOT produce separate nodes. Only standalone `system-of-record` files in `systems-of-record/` become nodes and receive `tracked-in` edges.
5. **Cross-org:** Team and workstream descriptors are org-scoped. Files stored flat under `teams/<id>.yaml` belong to the default org; files under `teams/<other-org>/<id>.yaml` belong to that org.

---

## 5. Validation errors

The graph-validation gate surfaces actionable errors for:

| Code | Level | Message template |
|---|---|---|
| `unresolved-ref` | warn | `Unresolved <kind> reference "<ref>"` |
| `unknown-kind` | warn | `No convention for kind "<kind>"` |
| `missing-id` | warn | `Entity has no id` |
| `missing-type` | warn | `Entity has no @type` |
| `unknown-prefix` | error | `No URN base in context for kind "<kind>"` |

All codes are stable machine keys, suitable for CI filtering.

---

## 6. Cluster and visual defaults

Each descriptor kind gets its own cluster in the organizational layer. Suggested palette — host repos may override via `config.clusters`:

| Kind | Cluster id | Suggested color | Layer |
|---|---|---|---|
| `team` | `team` | `#4A9CC8` | `work` |
| `workstream` | `workstream` | `#58a6ff` | `work` |
| `priority` | `priority` | `#E8A838` | `work` |
| `person` | `person` | `#3fb950` | `work` |
| `system-of-record` | `system-of-record` | `#a371f7` | `work` |

All five kinds are `durable` lifecycle — they appear in the graph across all planning cycles without cycle-specific variants.

The organizational layer is intentionally its own **graph region**: team → workstream → priority forms a backbone that anchors squads and missions. The visual separation emerges naturally from the cluster assignment without extra layout hints.

---

## 7. `sourceFile` threading (F5 / PR #205)

Every descriptor node carries `sourceFile: { path, raw, format }` — the repo-relative path, verbatim YAML, and format — so the in-app editor can load and edit the real file and hand the diff off to GitHub as a PR. No extra wiring is needed: the builder's `emitNode` already sets `sourceFile` for every entity file, and descriptor files are entity files.

---

## 8. Versioning and stability

- **Stable:** `@type`, `id`, `name`, `description`, `members`, `workstreams`, `lead`, `priority`, `team`, `manager`, `alias`, `rank`, `url`.
- **Open (any extra field passes through):** All five kinds default to `passthrough: undefined` in `conventions.yaml`, meaning every YAML key is copied verbatim into `data`. Host repos may add fields without editing the engine.
- **Not yet stable:** The inline `systems-of-record` shape on workstreams; the engine currently threads it to `tracked-in` edges only for standalone `system-of-record` files. Inline-to-node promotion may land in a follow-on issue.
- **Non-goals (separate sub-issues):** Release ingestion, live person-activity aggregation, workstream-cycle per-descriptor rollups.
