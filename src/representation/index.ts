/**
 * Representation layer — how a pure `KBGraph` is rendered for the SPA target:
 * edge/relation/node-layer styling, graph-layer projection, and named views.
 *
 * Kept separate from the pure data contract in `../types` (Phase 2 / F2 #309) so
 * the data types import nothing from the engine at load and can be consumed as
 * pure data by other representation targets (json-ld, llm-context).
 */
export * from './styles';
export * from './graph-layers';
export * from './views';
