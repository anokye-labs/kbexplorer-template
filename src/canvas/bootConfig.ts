/**
 * Canvas boot config (#406, epic #407 / #401).
 *
 * When the SPA is hosted inside a Copilot canvas iframe, the kbexplorer-cli
 * loopback server (kbexplorer-cli#190) injects a small boot object on
 * `window.__KBX_CANVAS__` BEFORE the embeddable entry (`src/canvas.tsx`) runs.
 * This module is the typed, defensive reader for that object — it never throws
 * on a missing/partial/host-tampered value and always resolves to a complete
 * {@link CanvasBootConfig} with safe defaults, so the headless mount can boot
 * deterministically.
 *
 * Pure and DOM-light: {@link parseCanvasBootConfig} takes the raw value so it is
 * unit-testable without a global; {@link readCanvasBootConfig} reads the global.
 */

/**
 * The visual mode the embeddable surface renders in. `inherit-host` defers all
 * Fluent tokens to the host theme mirrored onto the iframe `:root` (see
 * `theme/hostTheme.ts`); `config` uses the repo's own configured theme.
 */
export type CanvasVisualMode = 'inherit-host' | 'config';

/**
 * Which registered {@link RepresentationTarget} the embeddable canvas resolves.
 * Defaults to `copilot` — the bespoke, agent-driven surface (#440, epic #407).
 * `spa` is retained as an escape hatch so a host can fall back to the full
 * explorer route tree unchanged. The full-page `App`/`main.tsx` path always
 * renders `spa` and is unaffected by this field.
 */
export type CanvasRepresentationTarget = 'copilot' | 'spa';

/** The boot object the canvas host mirrors onto `window.__KBX_CANVAS__`. */
export interface CanvasBootConfig {
  /**
   * Whether the graph is served from the pre-built local manifest (loopback)
   * rather than a live system of record. Forward-compat/informational: local
   * detection is still driven by the `VITE_KB_LOCAL` build flag, so the CLI
   * builds the canvas bundle with `build:local`.
   */
  local: boolean;
  /** Visual mode — defaults to `inherit-host` for the canvas surface. */
  visualMode: CanvasVisualMode;
  /**
   * Representation target the canvas resolves — defaults to `copilot` (#440),
   * the bespoke agent-driven surface. Set to `spa` to render the full explorer
   * route tree instead. Initially both render the same viewers; the `copilot`
   * target is the seam the anchor-first bespoke view (#408) replaces.
   */
  target: CanvasRepresentationTarget;
  /**
   * Loopback search-service URL the host exposes for semantic search.
   *
   * Reserved / forward-compat: parsed and carried on the boot contract now, but
   * not yet consumed. The embeddable search wiring (this URL → the SPA search
   * hook, mirroring `VITE_SEARCH_SERVICE_URL`) lands with the CLI `/search`
   * endpoint (kbexplorer-cli A3 / #192). Until then the surface degrades to the
   * in-memory search index; absent ⇒ same behavior.
   */
  searchServiceUrl?: string;
  /**
   * Optional node the conversation is anchored to. When set, the headless mount
   * lands on that node (`/node/<id>`) instead of the repo's landing view — the
   * seam the anchor-first home view (#408) builds on.
   */
  anchorNodeId?: string;
}

/** The safe baseline used when the host mirrors nothing usable. */
export const DEFAULT_CANVAS_BOOT_CONFIG: CanvasBootConfig = {
  local: false,
  visualMode: 'inherit-host',
  target: 'copilot',
};

const VISUAL_MODES: readonly CanvasVisualMode[] = ['inherit-host', 'config'];
const REPRESENTATION_TARGETS: readonly CanvasRepresentationTarget[] = [
  'copilot',
  'spa',
];

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/**
 * A trimmed string candidate for enum-style fields: strings are trimmed (so a
 * host value like `'copilot '` or `'inherit-host\n'` still matches the allowed
 * set), non-strings become `undefined` (⇒ the caller falls back to its default).
 */
function enumCandidate(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined;
}

/**
 * Normalize an arbitrary raw value (typically `window.__KBX_CANVAS__`) into a
 * complete {@link CanvasBootConfig}. Unknown/invalid fields fall back to the
 * documented defaults; a non-object input yields the full default config.
 */
export function parseCanvasBootConfig(raw: unknown): CanvasBootConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CANVAS_BOOT_CONFIG };
  const obj = raw as Record<string, unknown>;

  const visualModeCandidate = enumCandidate(obj.visualMode);
  const visualMode = VISUAL_MODES.includes(visualModeCandidate as CanvasVisualMode)
    ? (visualModeCandidate as CanvasVisualMode)
    : DEFAULT_CANVAS_BOOT_CONFIG.visualMode;

  const targetCandidate = enumCandidate(obj.target);
  const target = REPRESENTATION_TARGETS.includes(
    targetCandidate as CanvasRepresentationTarget,
  )
    ? (targetCandidate as CanvasRepresentationTarget)
    : DEFAULT_CANVAS_BOOT_CONFIG.target;

  return {
    local: typeof obj.local === 'boolean' ? obj.local : DEFAULT_CANVAS_BOOT_CONFIG.local,
    visualMode,
    target,
    searchServiceUrl: optionalString(obj.searchServiceUrl),
    anchorNodeId: optionalString(obj.anchorNodeId),
  };
}

/** Global shape the host injects; declared for typed reads without `any`. */
declare global {
  interface Window {
    __KBX_CANVAS__?: unknown;
  }
}

/**
 * Read and normalize `window.__KBX_CANVAS__`. Returns the full default config
 * when there is no window (SSR/tests) or the host injected nothing.
 */
export function readCanvasBootConfig(): CanvasBootConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_CANVAS_BOOT_CONFIG };
  return parseCanvasBootConfig(window.__KBX_CANVAS__);
}
