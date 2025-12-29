import type { PlayerState } from "../game";

const STORAGE_KEY = "idle-finance-player-state";
const DB_NAME = "idle-finance-db";
const STORE_NAME = "player";
const DB_VERSION = 1;

export function serializePlayerState(state: PlayerState): string {
  return JSON.stringify(state);
}

export function deserializePlayerState(raw: string | null): PlayerState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PlayerState>;
    if (typeof parsed.schemaVersion !== "number") return null;
    return parsed as PlayerState;
  } catch {
    return null;
  }
}

function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveToIndexedDB(state: PlayerState): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(state, STORAGE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function loadFromIndexedDB(): Promise<PlayerState | null> {
  const db = await openDatabase();
  const value = await new Promise<PlayerState | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(STORAGE_KEY);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  if (!value || typeof value.schemaVersion !== "number") return null;
  return value;
}

function saveToLocalStorage(state: PlayerState): void {
  localStorage.setItem(STORAGE_KEY, serializePlayerState(state));
}

function loadFromLocalStorage(): PlayerState | null {
  return deserializePlayerState(localStorage.getItem(STORAGE_KEY));
}

export async function loadPlayerState(): Promise<PlayerState | null> {
  if (isIndexedDBAvailable()) {
    try {
      return await loadFromIndexedDB();
    } catch {
      // Fall back to localStorage.
    }
  }

  if (typeof localStorage === "undefined") {
    return null;
  }

  return loadFromLocalStorage();
}

export async function savePlayerState(state: PlayerState): Promise<void> {
  if (isIndexedDBAvailable()) {
    try {
      await saveToIndexedDB(state);
      return;
    } catch {
      // Fall back to localStorage.
    }
  }

  if (typeof localStorage === "undefined") {
    return;
  }

  saveToLocalStorage(state);
}

export async function clearPlayerState(): Promise<void> {
  if (isIndexedDBAvailable()) {
    try {
      const db = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.delete(STORAGE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      return;
    } catch {
      // Fall back to localStorage.
    }
  }

  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}
