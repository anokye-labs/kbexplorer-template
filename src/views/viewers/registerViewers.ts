/**
 * Shared viewer-registration composition (A4, epic anokye-labs/kbexplorer#130).
 *
 * The single seam that BOTH app entries — the full-page SPA (`main.tsx`) and the
 * embeddable canvas (`canvas.tsx`) — call once at boot to populate the viewer
 * registry. Centralizing registration here makes surface parity hold *by
 * construction*: neither entry can drift into an empty registry, which would
 * make `resolveViewer` fall back to {@link GenericStructuredView} for every node
 * (the copilot-surface bug this module fixes — kbexplorer-template#494).
 *
 * It is also the composition point where **provider render contributions** are
 * layered on top of the built-in viewers (A2, kbexplorer-template#492). Provider
 * `registerViewer(type, Component)` calls belong inside this function, *after*
 * the built-ins, so the registry's last-registration-wins precedence lets a
 * provider override a built-in viewer for a given entity type. Keep the built-in
 * pass first and additive so that ordering contract stays intact.
 */
import { registerBuiltinViewers } from './builtin-map';

/**
 * Compose and register every viewer both app surfaces should have at boot.
 *
 * Today this is just the ~15 bespoke built-in entity viewers. It is the
 * designated extension point for A2's provider render contributions — add those
 * here, after {@link registerBuiltinViewers}, so provider viewers can override
 * built-ins by type.
 */
export function registerViewers(): void {
  registerBuiltinViewers();
  // A2 (kbexplorer-template#492): provider render contributions are composed
  // here, after the built-ins, so a provider viewer wins for its entity type.
}
