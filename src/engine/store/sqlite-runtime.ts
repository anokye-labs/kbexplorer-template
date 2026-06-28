import initSqlJs from 'sql.js';
import type { Database, SqlJsStatic } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

export interface SqliteByteStore {
  load(): Promise<Uint8Array | undefined>;
  save(bytes: Uint8Array): Promise<void>;
}

const DB_NAME = 'kbexplorer-graph-store';
const STORE_NAME = 'sqlite';
const DB_KEY = 'graph-store.sqlite';

let sqlModulePromise: Promise<SqlJsStatic> | undefined;

export async function loadSqlJs(): Promise<SqlJsStatic> {
  sqlModulePromise ??= initSqlJs({
    locateFile: () => resolveSqlJsWasmPath(wasmUrl),
  });
  return sqlModulePromise;
}

export async function openPersistedDatabase(
  byteStore: SqliteByteStore = new IndexedDbSqliteByteStore(),
): Promise<{ db: Database; persist: () => Promise<void> }> {
  const SQL = await loadSqlJs();
  const bytes = await byteStore.load();
  const db = bytes ? new SQL.Database(bytes) : new SQL.Database();
  return {
    db,
    persist: async () => {
      await byteStore.save(db.export());
    },
  };
}

export class MemorySqliteByteStore implements SqliteByteStore {
  private bytes?: Uint8Array;

  async load(): Promise<Uint8Array | undefined> {
    return this.bytes ? new Uint8Array(this.bytes) : undefined;
  }

  async save(bytes: Uint8Array): Promise<void> {
    this.bytes = new Uint8Array(bytes);
  }
}

export class IndexedDbSqliteByteStore implements SqliteByteStore {
  async load(): Promise<Uint8Array | undefined> {
    const db = await openIndexedDb();
    return requestToPromise<Uint8Array | undefined>(
      db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(DB_KEY),
    ).finally(() => db.close());
  }

  async save(bytes: Uint8Array): Promise<void> {
    const db = await openIndexedDb();
    await requestToPromise(
      db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(bytes, DB_KEY),
    ).finally(() => db.close());
  }
}

function openIndexedDb(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) {
    throw new Error('Graph store SQLite persistence requires IndexedDB support.');
  }

  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open graph store IndexedDB database.'));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB graph store request failed.'));
  });
}

function resolveSqlJsWasmPath(url: string): string {
  const maybeProcess = (globalThis as { process?: { cwd?: () => string } }).process;
  if (url.startsWith('/node_modules/') && maybeProcess?.cwd) {
    return `${maybeProcess.cwd()}${url}`;
  }
  return url;
}
