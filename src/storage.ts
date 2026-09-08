import type { State } from "./state";

const DB_NAME = "sl-durian-db";
const DB_VERSION = 1;
const STORE = "kv";
const STATE_KEY = "state";
const HANDLE_KEY = "fileHandle";
const HANDLE_NAME_KEY = "fileHandleName";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function get<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function set(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function del(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadState(): Promise<State | undefined> {
  try {
    return await get<State>(STATE_KEY);
  } catch {
    return undefined;
  }
}

export async function saveState(state: State): Promise<void> {
  try {
    await set(STATE_KEY, state);
  } catch {
    /* best-effort: a full IndexedDB or private browsing must not crash the app */
  }
}

/** Any File System Access handle-shaped object; the real type isn't in lib.dom in every TS config. */
export type FileHandleLike = FileSystemFileHandle;

export async function loadFileHandle(): Promise<{ handle: FileHandleLike; name: string } | undefined> {
  try {
    const handle = await get<FileHandleLike>(HANDLE_KEY);
    const name = await get<string>(HANDLE_NAME_KEY);
    if (!handle) return undefined;
    return { handle, name: name ?? handle.name };
  } catch {
    return undefined;
  }
}

export async function saveFileHandle(handle: FileHandleLike): Promise<void> {
  try {
    await set(HANDLE_KEY, handle);
    await set(HANDLE_NAME_KEY, handle.name);
  } catch {
    /* best-effort */
  }
}

export async function clearFileHandle(): Promise<void> {
  try {
    await del(HANDLE_KEY);
    await del(HANDLE_NAME_KEY);
  } catch {
    /* best-effort */
  }
}
