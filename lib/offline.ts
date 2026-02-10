/* ============================================================
   Offline-first IndexedDB caching with Web Crypto encryption
   Uses the `idb` library for ergonomic IndexedDB access.
   ============================================================ */
"use client";

import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "medscheduler-offline";
const DB_VERSION = 1;

// Store names
const STORES = {
  surgeries: "surgeries",
  schedule: "schedule",
  equipment: "equipment",
  queue: "queue",
  meta: "meta",
} as const;

/* ── Database initialization ────────────────────────────── */
let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (typeof window === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
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
    await tx.store.put({ id: item.id, data: encrypted });
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

/* ── Online/Offline status hook data ────────────────────── */
export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

export { STORES };
