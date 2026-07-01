/**
 * `copilot` representation (B1 #440, epic #407 / #401).
 *
 * The destination surface for Copilot: a distinct {@link RepresentationTarget}
 * the embeddable canvas resolves so the panel can render a Copilot-bespoke view
 * of the SAME pure `KBGraph` the `spa` target renders. Registering it as its own
 * named target — rather than reusing `spa` from the canvas mount — gives the
 * bespoke children a stable seam to build on: the anchor-first home view (#408),
 * the agent-action surface (#409), the affordance-aware launchpad (#411), etc.
 *
 * INITIALLY it delegates to the `spa` route tree ({@link renderSpaRoutes}) so it
 * reuses the existing node viewers (`src/views/viewers/*`), `kg://` identity +
 * relations, and `graph.related` / `llm-context` expansion unchanged. This keeps
 * #440 purely additive — the target NAME the canvas resolves is the only change
 * vs. #406. #408 replaces the render body below with the narrow-column,
 * agent-driven, anchor-first layout without touching the registration/wiring.
 */
import type { ReactNode } from 'react';
import type { Representation } from '@anokye-labs/kbexplorer-core';
import { renderSpaRoutes, type SpaRenderOptions } from './spa';

/**
 * Runtime context the copilot view needs beyond the pure graph. Identical to
 * {@link SpaRenderOptions} today because the render delegates to the spa route
 * tree; kept as its own alias so #408 can widen it (agent actions, anchors)
 * without disturbing the spa target's option shape.
 */
export type CopilotRenderOptions = SpaRenderOptions;

/** Render the copilot surface for an already-built graph (reuses spa viewers). */
export function renderCopilotSurface(
  graph: Parameters<typeof renderSpaRoutes>[0],
  options: CopilotRenderOptions,
): ReactNode {
  return renderSpaRoutes(graph, options);
}

/** The registered `copilot` representation target. */
export const copilotRepresentation: Representation<ReactNode> = {
  target: 'copilot',
  render(graph, options) {
    return renderCopilotSurface(graph, options as CopilotRenderOptions);
  },
};
