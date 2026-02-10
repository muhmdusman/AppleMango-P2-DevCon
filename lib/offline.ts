/* ============================================================
   Offline-first IndexedDB caching with Web Crypto encryption
   Uses the `idb` library for ergonomic IndexedDB access.
   Features:
   - AES-GCM encryption for all cached data
   - Background Sync API for deferred sync
   - Conflict resolution with timestamps
   - Quota management and cleanup
   - Sync status tracking
   ============================================================ */
"use client";

import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "medscheduler-offline";
const DB_VERSION = 2;

// Store names
const STORES = {
  surgeries: "surgeries",
  schedule: "schedule",
  equipment: "equipment",
  queue: "queue",
  meta: "meta",
  pendingSync: "pendingSync",
} as const;

/* ── Database initialization ────────────────────────────── */
let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (typeof window === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Create object stores with keyPath
        if (!db.objectStoreNames.contains(STORES.surgeries)) {
          db.createObjectStore(STORES.surgeries, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORES.schedule)) {
          db.createObjectStore(STORES.schedule, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORES.equipment)) {
          db.createObjectStore(STORES.equipment, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORES.queue)) {
          db.createObjectStore(STORES.queue, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORES.meta)) {
          db.createObjectStore(STORES.meta, { keyPath: "key" });
        }
        // v2: pending sync store for Background Sync API
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains(STORES.pendingSync)) {
            const store = db.createObjectStore(STORES.pendingSync, { keyPath: "id", autoIncrement: true });
            store.createIndex("timestamp", "timestamp");
            store.createIndex("type", "type");
          }
        }
      },
    });
  }
  return dbPromise;
}

/* ── Web Crypto encryption helpers ──────────────────────── */
async function getEncryptionKey(): Promise<CryptoKey> {
  const stored = localStorage.getItem("medscheduler-key");
  if (stored) {
    const raw = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
    return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  }
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const exported = await crypto.subtle.exportKey("raw", key);
  localStorage.setItem("medscheduler-key", btoa(String.fromCharCode(...new Uint8Array(exported))));
  return key;
}

async function encryptData(data: unknown): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptData<T>(ciphertext: string): Promise<T> {
  const key = await getEncryptionKey();
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

/* ── Generic CRUD for offline stores ────────────────────── */
export async function cacheItems<T extends { id: string }>(
  storeName: string,
  items: T[]
): Promise<void> {
  const db = await getDB();
  if (!db) return;
  const tx = db.transaction(storeName, "readwrite");
  for (const item of items) {
    const encrypted = await encryptData(item);
    await tx.store.put({ id: item.id, data: encrypted, cachedAt: Date.now() });
  }
  await tx.done;
  // Save sync timestamp
  const metaTx = db.transaction(STORES.meta, "readwrite");
  await metaTx.store.put({ key: `${storeName}-lastSync`, value: Date.now() });
  await metaTx.done;
}

export async function getCachedItems<T>(storeName: string): Promise<T[]> {
  const db = await getDB();
  if (!db) return [];
  const items = await db.getAll(storeName);
  const decrypted: T[] = [];
  for (const item of items) {
    try {
      const data = await decryptData<T>(item.data);
      decrypted.push(data);
    } catch {
      // Skip corrupted entries
    }
  }
  return decrypted;
}

export async function getLastSync(storeName: string): Promise<number | null> {
  const db = await getDB();
  if (!db) return null;
  const meta = await db.get(STORES.meta, `${storeName}-lastSync`);
  return meta?.value ?? null;
}

export async function clearStore(storeName: string): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.clear(storeName);
}

/* ── Background Sync API ────────────────────────────────── */
export interface PendingSyncItem {
  id?: number;
  type: "create" | "update" | "delete" | "status_change";
  entity: string; // "surgery" | "equipment" | "notification"
  entityId?: string;
  payload: Record<string, unknown>;
  timestamp: number;
  retries: number;
}

/** Queue an action for background sync (when offline) */
export async function queueForSync(item: Omit<PendingSyncItem, "timestamp" | "retries">): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.add(STORES.pendingSync, { ...item, timestamp: Date.now(), retries: 0 });

  // Register for Background Sync if available
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      // @ts-expect-error — Background Sync API
      await reg.sync.register("medscheduler-sync");
    } catch {
      // Fallback: sync will happen on next online event
    }
  }
}

/** Get all pending sync items */
export async function getPendingSyncItems(): Promise<PendingSyncItem[]> {
  const db = await getDB();
  if (!db) return [];
  return await db.getAll(STORES.pendingSync);
}

/** Remove a synced item from pending */
export async function removeSyncedItem(id: number): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.delete(STORES.pendingSync, id);
}

/** Clear all pending sync items */
export async function clearPendingSync(): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.clear(STORES.pendingSync);
}

/* ── Conflict Resolution ────────────────────────────────── */
export interface ConflictResult<T> {
  resolved: T;
  strategy: "local" | "remote" | "merge";
}

/**
 * Resolve conflicts between local and remote data.
 * Uses "last-write-wins" with timestamp comparison.
 * For surgeries, merged fields include status and notes.
 */
export function resolveConflict<T extends { id: string; updated_at?: string }>(
  local: T,
  remote: T
): ConflictResult<T> {
  const localTime = local.updated_at ? new Date(local.updated_at).getTime() : 0;
  const remoteTime = remote.updated_at ? new Date(remote.updated_at).getTime() : 0;

  if (remoteTime > localTime) {
    return { resolved: remote, strategy: "remote" };
  }
  if (localTime > remoteTime) {
    return { resolved: local, strategy: "local" };
  }
  // Same timestamp — merge (remote properties win for conflicts)
  return { resolved: { ...local, ...remote }, strategy: "merge" };
}

/* ── Quota Management ───────────────────────────────────── */

/** Check available storage quota */
export async function getStorageQuota(): Promise<{ used: number; quota: number; percentUsed: number } | null> {
  if (!("storage" in navigator && "estimate" in navigator.storage)) return null;
  const estimate = await navigator.storage.estimate();
  const used = estimate.usage ?? 0;
  const quota = estimate.quota ?? 0;
  return { used, quota, percentUsed: quota > 0 ? Math.round((used / quota) * 100) : 0 };
}

/** Clean up old cache entries to free space (keeps last 500 items per store) */
export async function cleanupOldEntries(storeName: string, maxItems = 500): Promise<number> {
  const db = await getDB();
  if (!db) return 0;
  const tx = db.transaction(storeName, "readwrite");
  const allKeys = await tx.store.getAllKeys();
  if (allKeys.length <= maxItems) {
    await tx.done;
    return 0;
  }
  const toDelete = allKeys.slice(0, allKeys.length - maxItems);
  for (const key of toDelete) {
    await tx.store.delete(key);
  }
  await tx.done;
  return toDelete.length;
}

/* ── Sync Status Management ─────────────────────────────── */

export interface SyncStatus {
  lastSyncTime: number | null;
  pendingCount: number;
  isOnline: boolean;
  storageUsed: number | null;
}

/** Get comprehensive sync status */
export async function getSyncStatus(): Promise<SyncStatus> {
  const pending = await getPendingSyncItems();
  const lastSync = await getLastSync(STORES.surgeries);
  const quota = await getStorageQuota();

  return {
    lastSyncTime: lastSync,
    pendingCount: pending.length,
    isOnline: isOnline(),
    storageUsed: quota?.percentUsed ?? null,
  };
}

/* ── Online/Offline status hook data ────────────────────── */
export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

export { STORES };
