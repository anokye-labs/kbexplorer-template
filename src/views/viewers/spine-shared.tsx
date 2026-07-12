/**
 * Shared building blocks for the content-model spine viewers (F2 / T2.5 + T2.6).
 *
 * These house-style primitives now live in the published render contract
 * (`@anokye-labs/kbexplorer-view-kit`) so third-party lenses match the built-in
 * viewers by default. Re-exported here so existing `./spine-shared` importers
 * keep working and there is exactly one definition.
 *
 * className-styled only (no pixel sizing, SSR-safe) so the bespoke viewers render
 * identically under `renderToStaticMarkup` in tests and in the live app.
 */
export {
  EntityHeader,
  Row,
  ScalarList,
  Pill,
} from '@anokye-labs/kbexplorer-view-kit';

