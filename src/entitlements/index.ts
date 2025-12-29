export type EntitlementsState = {
  isVip: boolean;
  vipExpiresAt?: number;
  offlineBoostExpiresAt?: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  vipStatus?: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
  vipCurrentPeriodEnd?: number;
};

const STORAGE_KEY = "idle-finance-entitlements";
const DB_NAME = "idle-finance-db";
const STORE_NAME = "entitlements";
const DB_VERSION = 1;

function serializeEntitlements(entitlements: EntitlementsState): string {
  return JSON.stringify(entitlements);
}

function deserializeEntitlements(raw: string | null): EntitlementsState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<EntitlementsState>;
    const normalized: EntitlementsState = {
      isVip: typeof parsed.isVip === "boolean" ? parsed.isVip : false,
      vipExpiresAt: parsed.vipExpiresAt,
      offlineBoostExpiresAt: parsed.offlineBoostExpiresAt,
      stripeCustomerId: parsed.stripeCustomerId,
      stripeSubscriptionId: parsed.stripeSubscriptionId,
      vipStatus: parsed.vipStatus,
      vipCurrentPeriodEnd: parsed.vipCurrentPeriodEnd,
    };
    return normalized;
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

async function saveToIndexedDB(entitlements: EntitlementsState): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(entitlements, STORAGE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function loadFromIndexedDB(): Promise<EntitlementsState | null> {
  const db = await openDatabase();
  const value = await new Promise<EntitlementsState | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(STORAGE_KEY);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  if (!value || typeof value.isVip !== "boolean") return null;
  return value;
}

function saveToLocalStorage(entitlements: EntitlementsState): void {
  localStorage.setItem(STORAGE_KEY, serializeEntitlements(entitlements));
}

function loadFromLocalStorage(): EntitlementsState | null {
  return deserializeEntitlements(localStorage.getItem(STORAGE_KEY));
}

export async function loadEntitlements(): Promise<EntitlementsState | null> {
  if (isIndexedDBAvailable()) {
    try {
      return await loadFromIndexedDB();
    } catch {
      // fallback to localStorage
    }
  }

  if (typeof localStorage === "undefined") {
    return null;
  }

  return loadFromLocalStorage();
}

export function normalizeVip(entitlements: EntitlementsState): EntitlementsState {
  const vipActive =
    entitlements.vipStatus === "active" || entitlements.vipStatus === "trialing";
  return {
    ...entitlements,
    isVip: vipActive || entitlements.isVip,
    vipExpiresAt:
      entitlements.vipCurrentPeriodEnd ?? entitlements.vipExpiresAt,
  };
}

export async function saveEntitlements(
  entitlements: EntitlementsState,
): Promise<void> {
  if (isIndexedDBAvailable()) {
    try {
      await saveToIndexedDB(entitlements);
      return;
    } catch {
      // fallback to localStorage
    }
  }

  if (typeof localStorage === "undefined") {
    return;
  }

  saveToLocalStorage(entitlements);
}

export async function clearEntitlements(): Promise<void> {
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
      // fallback to localStorage
    }
  }

  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function getActiveEntitlements(
  entitlements: EntitlementsState | null,
  now: number,
): {
  vipActive: boolean;
  vipRemainingMs: number;
  offlineBoostActive: boolean;
  offlineBoostRemainingMs: number;
} {
  const vipExpiresAt = entitlements?.vipExpiresAt ?? 0;
  const offlineBoostExpiresAt = entitlements?.offlineBoostExpiresAt ?? 0;
  const vipRemainingMs = Math.max(0, vipExpiresAt - now);
  const offlineBoostRemainingMs = Math.max(0, offlineBoostExpiresAt - now);

  return {
    vipActive: Boolean(entitlements?.isVip) && vipRemainingMs > 0,
    vipRemainingMs,
    offlineBoostActive: offlineBoostRemainingMs > 0,
    offlineBoostRemainingMs,
  };
}
