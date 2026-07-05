/**
 * Shim — re-exports from `@anokye-labs/kbexplorer-engine/store` (moved in
 * anokye-labs/kbexplorer-template#472/#473, slice 5/5 STEP B). The wasm path
 * resolution (the one legitimate Vite URL-suffix import) stays template-side
 * — see `./browser-wasm.ts`.
 */
export {
  IndexedDbSqliteByteStore,
  MemorySqliteByteStore,
  loadSqlJs,
  openPersistedDatabase,
  type SqliteByteStore,
} from '@anokye-labs/kbexplorer-engine/store';
