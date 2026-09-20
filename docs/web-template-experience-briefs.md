# Web Template Experience Briefs

This brief defines the three externally visible product shapes for the kbexplorer-template showcase. It is intentionally a product contract, not an Engine spec.

## Product boundary

- The Engine owns graph construction, manifest generation, validation, enrichment, and domain logic.
- Templates consume the published KBX contracts only: registry data, provider outputs, manifest objects, and view-kit primitives.
- Presentation code must not import Engine internals, sibling-template implementation, or copied domain logic.
- The current site remains the baseline template; the other two templates are distinct products with different jobs, audiences, and information architectures.

## Shared fixture and acceptance journeys

All three templates must validate against the same neutral fixture so the product delta is in UX, not in backing data.

### Shared fixture

Use a single fixture bundle built from the repo's public knowledge graph with the following shape:

- 1 repository hub
- 1 README / landing narrative
- 3 issue clusters (architecture, UX, release)
- 3 related source files or folders
- 2 pull requests or release notes
- 1 search query with multiple matches
- 1 empty or missing-node variant for error recovery
- 1 loading state and 1 validation failure state

Representative journeys every template must support:

1. `open-and-orient` — load the landing view and understand the repo or subject in under five actions.
2. `find-by-keyword` — search for a term or issue and land on the correct node.
3. `deep-dive` — open a node, read its content, and inspect adjacent content.
4. `move-between-related` — traverse to a related issue, source file, or doc without losing context.
5. `recover-cleanly` — handle loading, empty, or failed content states without a blank screen or broken navigation.

These journeys are product-level acceptance checks; the template-specific UI can satisfy them differently as long as the core intent is preserved.

## Template 1 — Repository Atlas (baseline)

- Endpoint slug: `/atlas`
- Audience: maintainers, contributors, and technically curious readers who want a repository map.
- Jobs:
  - understand the repo at a glance
  - find the next area of interest by issue, cluster, or topic
  - connect documentation, issues, source, and decisions without leaving the repo context
- Interaction model:
  - overview first, graph second, detail last
  - keyboard-first navigation plus strong click-through from clusters to content
  - persistent contextual side panel for related nodes and summaries
- Information architecture:
  - landing overview -> cluster map -> node detail -> adjacent content
  - core affordances: search, filter, node adjacency, reading view, minimap
- Visual direction:
  - current baseline: research/engineering dashboard, neutral dark base, high-contrast labels, cluster color coding, dense but readable graph
  - aim for density without overload; keep the graph expressive but not decorative

### Template 1 journeys

- `repo overview` — arrive at the hub and identify the dominant issue clusters immediately.
- `graph traversal` — move from an issue to a related PR, doc, or implementation file.
- `reading continuity` — open a markdown or issue and continue to its related nodes from within the reader.

## Template 2 — Execution Briefing (distinct product)

- Endpoint slug: `/brief`
- Audience: product and engineering leaders, release managers, and cross-functional stakeholders who need a decision-ready view.
- Jobs:
  - answer "what is changing, what is blocked, and what matters now?"
  - compare trend lines across issues, docs, and release notes
  - move from signal to action with minimal exploration cost
- Interaction model:
  - high-signal briefing layout instead of a free-form graph
  - prioritized issue and decision stream with clear status and relationship framing
  - reads like a strategic dashboard: signal, rationale, dependencies, next steps
- Information architecture:
  - brief overview -> priority stream -> dependency detail -> evidence and follow-up
  - emphasis on filters, status grouping, and narrative summaries rather than low-level graph density
- Visual direction:
  - editorial dashboard with calm neutral surfaces, clearer hierarchy, stronger typography, and visible status differentiation
  - fewer visual distractions; decisions and risk stand out before detail

### Template 2 journeys

- `decision audit` — identify the most relevant unresolved issue or dependency from a brief.
- `risk scan` — review related work and infer what is blocked or at risk.
- `handoff view` — move from a decision summary into the underlying evidence and node detail for follow-up.

## Template 3 — Guided Field Guide (distinct product)

- Endpoint slug: `/field-guide`
- Audience: new contributors, learners, and repo explorers who need guided onboarding and conceptual understanding.
- Jobs:
  - learn the repository without reading everything
  - understand the mental model behind the system
  - follow a guided narrative from concept to implementation to adjacent references
- Interaction model:
  - guided path with chapters and checkpoints
  - topic-first exploration, then progressive drilldowns into evidence and implementation context
  - less like a dashboard and more like a structured walkthrough
- Information architecture:
  - start path -> concept blocks -> supporting evidence -> related next steps
  - chapters, breadcrumbs, and concept relationships are primary navigation
- Visual direction:
  - immersive and legible, with more whitespace and stronger narrative pacing
  - lighter, more educational tone, with highlighted “next concept” cards and guided progress markers

### Template 3 journeys

- `onboarding path` — begin with a broad concept and follow the recommended path through the repo.
- `concept drilldown` — land on a concept node and read its supporting materials in order.
- `next-step discovery` — follow the suggested adjacent concept or implementation area.

## Shared acceptance criteria

### UX and business outcomes

- Each template must satisfy the same five representative journeys above against the shared fixture.
- Every template must provide a clear initial orientation within five visible actions from the landing state.
- Primary actions must be discoverable without reading documentation; the user should be able to find a relevant topic or issue in under 30 seconds on a desktop-sized view.
- Each template must include a persistent escape route back to the top-level summary or hub.
- No template may rely on hidden behavior or a duplicate Engine implementation to reach the same result.

### Accessibility

- All templates must meet WCAG 2.2 AA for contrast, focus visibility, heading order, and keyboard navigation.
- All interactive elements must be keyboard reachable and must expose visible focus states with a minimum 3px focus ring and no color-only indication.
- Nodes, cards, and links must have clear accessible names; screen-reader users must be able to traverse the same primary workflow as mouse users.
- Controls that trigger navigation, filtering, or state changes must maintain a logical tab order and visible focus retention.
- The shared fixture must be testable with keyboard-only flows for all five representative journeys.

### Responsive behavior

- Desktop: 1280px and above must maintain the full default template layout.
- Tablet: 768px-1279px must preserve primary navigation and content hierarchy without horizontal scrolling.
- Mobile: 320px-767px must maintain critical reading and search actions; secondary panels may collapse or move below content.
- Each template must avoid horizontal overflow for text, cards, and graph surfaces within the supported layouts.
- The shared fixture must remain navigable through the template-specific mobile adaptation without content loss.

### Performance

- Shared fixture initial load must render the first meaningful UI within 2.5s on a simulated fast 4G profile in CI.
- The main interaction target for each journey must respond within 200ms after input.
- The UI must not show layout instability greater than 0.1 CLS during normal template transitions.
- A template-specific interaction must remain usable under a reduced browser budget; no template may require full graph re-layout to complete a core route change.
- Performance budgets are product-level gates, not a substitute for Engine validation; the template is allowed to depend on the Engine's public performance contracts and should not reimplement graph logic.

## Template-specific acceptance gates

### Template 1 — Repository Atlas

- Must preserve the current site's flagship graph + reading workflow and not regress its existing repo-aware behavior.
- Must expose a clear cluster overview, direct node navigation, and the same reading-depth affordances as the baseline.
- Must remain technically viable as the canonical repo-exploration experience.

### Template 2 — Execution Briefing

- Must prioritize signal, status, and dependency readability over graph density.
- Must clearly communicate what is urgent, blocked, and decision-relevant from the shared fixture.
- Must provide one-click entry from a summary state to the evidence node or dependency detail.

### Template 3 — Guided Field Guide

- Must present a path, not just a list: the user should feel guided from concept to supporting evidence.
- Must provide clear next-step suggestions through the fixture and maintain a coherent learning narrative.
- Must support branching exploration without losing the chapter structure.

## Definition of done for this task

This task is complete when:

- the three briefs are distinct and approved as product directions
- the baseline template remains the existing repo explorer
- the other two templates are materially different in audience, job, IA, and interaction model
- the shared fixture and representative journeys are defined and testable
- the acceptance criteria are measurable across UX, accessibility, responsiveness, and performance
- the brief explicitly preserves Engine ownership and public KBX-contract consumption

This work is a product-definition layer for the downstream implementation tasks (#555-#561). It is not a replacement for the Engine or template implementation, and it does not authorize direct Engine-domain reuse in presentation code.
