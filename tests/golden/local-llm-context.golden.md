# Knowledge graph context

- Anchored on 1 node(s); neighbor expansion budget ≈ 300 tokens.
- 1 neighbor(s) expanded, 11 linked for navigation.

## Anchor — Epic: Open, data-driven node-type engine for kbexplorer-template

`kg://node/issue-147`

🟢 **OPEN** · #147

Created: Jun 10, 2026 · Updated: Jun 10, 2026

[View on GitHub ↗](https://github.com/anokye-labs/kbexplorer-template/issues/147)

---

## Expanded neighbors

### What

`kg://node/issue-147/what` · contains · weight 5.00

Replace kbexplorer-template's **closed, compile-time** node-type system — hardcoded `NodeSource` / `DisplayMode` / `EdgeType` unions, a `renderContent` switch, and bespoke per-source providers — with an **open, data-driven** one:

- **JSON-LD node internals** (`@id` / `@type` / typed `data`) on `KBNode`.
- A **node-type registry** that declares each type's discovery, mapping, cluster, layer, relations, and viewer in one place.
- A **viewer registry keyed by `@type`** with a generic structured fallback (total coverage; bespoke viewers are additive).
- **Schema-driven content-model ingestion** that builds the graph from entity files (the model documented in `content-model.md`).
- **Repo-structural discovery**: `.github` workflows, Actions, and templates become nodes linked to the repository node.

## Navigate — follow `kg://` links for more

- [Why](kg://node/issue-147/why) · contains · weight 5.00 · `node/issue-147/why`
- [Adopted model](kg://node/issue-147/adopted-model) · contains · weight 5.00 · `node/issue-147/adopted-model`
- [Scope boundaries](kg://node/issue-147/scope-boundaries) · contains · weight 5.00 · `node/issue-147/scope-boundaries`
- [Success definition](kg://node/issue-147/success-definition) · contains · weight 5.00 · `node/issue-147/success-definition`
- [Children](kg://node/issue-147/children) · contains · weight 5.00 · `node/issue-147/children`
- [F1: Open node-type foundation — JSON-LD nodes + registries (#148)](urn:pr:171) · references · weight 2.00 · `urn:pr:171`
- [feat(engine): skill node type + sample content-model (make the engine visible)](urn:pr:180) · references · weight 2.00 · `urn:pr:180`
- [feat(editor): source-of-truth editor with GitHub PR write-back handoff](urn:pr:205) · references · weight 2.00 · `urn:pr:205`
- [feat(content-model): cross-repo vocabulary/synonym mapping (#153)](urn:pr:204) · references · weight 2.00 · `urn:pr:204`
- [docs(content): document the open node-type engine and all new node types](urn:pr:181) · references · weight 2.00 · `urn:pr:181`
- [Acceptance / Evidence](kg://node/issue-179/acceptance-evidence) · cross_references · weight 1.50 · `node/issue-179/acceptance-evidence`
