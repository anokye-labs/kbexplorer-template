/**
 * Canvas landing-path resolution (#406).
 *
 * Pure seam shared by the embeddable mount: an explicit `anchorNodeId` from the
 * boot config wins (the conversation-anchored node the #408 anchor-first view
 * builds on), otherwise the repo's own landing config applies.
 */
import type { KBConfig } from '../types';
import { resolveLandingPath } from '../landing/resolveLanding';

/** The initial hash-router path: anchor node if set, else the config landing. */
export function resolveCanvasLandingPath(config: KBConfig, anchorNodeId?: string): string {
  if (anchorNodeId) return `/node/${encodeURIComponent(anchorNodeId)}`;
  return resolveLandingPath(config);
}
