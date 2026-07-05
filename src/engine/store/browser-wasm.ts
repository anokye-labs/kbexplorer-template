/**
 * Browser wasm composition root for the graph store's sql.js runtime.
 *
 * The engine's `SQLiteGraphStore` (anokye-labs/kbexplorer-template#473,
 * slice 5/5 STEP B) is Node-compatible and boundary-pure: it accepts an
 * optional `locateFile` resolver instead of owning a Vite `?url` import
 * itself. Vite's `?url` suffix only means something inside a Vite build, so
 * it stays template-side — this is the ONE file in the codebase that imports
 * it for the graph store. The resolved absolute/dev-server path is then
 * injected into the engine at the loader call sites (`remote-loader.ts` /
 * `local-loader.ts`) so `SQLiteGraphStore.create` can find the wasm binary
 * without the engine ever touching Vite-specific import syntax.
 */
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

/**
 * Moved verbatim from the old `sqlite-runtime.ts` (pre-slice-5). During
 * `vite dev`, Vite serves `?url` imports for files under `node_modules` as
 * an absolute dev-server path (e.g. `/node_modules/sql.js/dist/sql-wasm.wasm`)
 * that isn't resolvable relative to the page origin without the project
 * root prefix; `initSqlJs`'s `locateFile` callback receives that raw path,
 * so we prefix it with `process.cwd()` in that dev-server case.
 */
function resolveSqlJsWasmPath(url: string): string {
  const maybeProcess = (globalThis as { process?: { cwd?: () => string } }).process;
  if (url.startsWith('/node_modules/') && maybeProcess?.cwd) {
    return `${maybeProcess.cwd()}${url}`;
  }
  return url;
}

/** `locateFile` resolver for the engine's `loadSqlJs`/`SQLiteGraphStore.create`. */
export const browserWasmLocateFile = (): string => resolveSqlJsWasmPath(wasmUrl);
