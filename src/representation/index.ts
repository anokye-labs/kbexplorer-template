/**
 * Representation layer — how a pure `KBGraph` is rendered for a target.
 *
 * Phase 2 (F2 #309) introduced the SPA-facing pieces: edge/relation/node-layer
 * styling, graph-layer projection, and named views. Phase 6 (F6 #333) adds the
 * {@link RepresentationRegistry} and the interchangeable `spa` / `json-ld` /
 * `llm-context` targets, so the same pure graph renders to multiple outputs
 * selected by name.
 *
 * Kept separate from the pure data contract in `../types` (Phase 2 / F2 #309) so
 * the data types import nothing from the engine at load and can be consumed as
 * pure data by other representation targets (json-ld, llm-context).
 */
export * from './styles';
export * from './graph-layers';
export * from './views';
export * from './registry';
export * from './targets';
