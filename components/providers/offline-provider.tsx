/* ============================================================
   Offline Provider — Service Worker registration, online/offline
   status, session persistence, and background sync management.
   Wraps the entire app to enable offline-first capabilities.
   ============================================================ */
"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  cacheItems,
  getCachedItems,
  queueForSync,
  getPendingSyncItems,
  removeSyncedItem,
  isOnline as checkOnline,
  STORES,
} from "@/lib/offline";
import { toast } from "sonner";

interface OfflineContextType {
  isOnline: boolean;
  pendingSyncCount: number;
  lastSyncTime: number | null;
  syncNow: () => Promise<void>;
  createSurgeryOffline: (data: Record<string, unknown>) => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType>({
  isOnline: true,
  pendingSyncCount: 0,
  lastSyncTime: null,
  syncNow: async () => {},
  createSurgeryOffline: async () => {},
});

export const useOffline = () => useContext(OfflineContext);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Register service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("[SW] Registered:", reg.scope);
        })
        .catch((err) => {
          console.warn("[SW] Registration failed:", err);
        });

      // Listen for sync status messages from SW
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "SYNC_STATUS") {
          setPendingSyncCount(event.data.pendingCount);
          if (event.data.status === "complete") {
            setLastSyncTime(Date.now());
            toast.success("Offline changes synced successfully");
          }
        }
      });
    }
  }, []);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Back online — syncing changes...");
      syncPending();
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("You are offline — changes will be saved locally", { duration: 5000 });
    };

    setIsOnline(checkOnline());
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Cache session to survive offline restarts
  useEffect(() => {
    const persistSession = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          localStorage.setItem("medscheduler-session", JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at,
            user: { id: session.user.id, email: session.user.email },
          }));
        }
      } catch {
        // Ignore errors during session caching
      }
    };

    persistSession();

    // Re-persist on auth state changes
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: { access_token: string; refresh_token: string; expires_at?: number; user: { id: string; email?: string } } | null) => {
      if (session) {
        localStorage.setItem("medscheduler-session", JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
          user: { id: session.user.id, email: session.user.email },
        }));
      } else {
        localStorage.removeItem("medscheduler-session");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Restore session on load if we're offline or session expired
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          const cached = localStorage.getItem("medscheduler-session");
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.refresh_token) {
              await supabase.auth.setSession({
                access_token: parsed.access_token,
                refresh_token: parsed.refresh_token,
              });
            }
          }
        }
      } catch {
        // Session restore failed, user may need to re-login
      }
    };
    restoreSession();
  }, []);

  // Sync pending items
  const syncPending = useCallback(async () => {
    if (!checkOnline()) return;
    try {
      const items = await getPendingSyncItems();
      if (items.length === 0) return;

      const supabase = createClient();

      for (const item of items) {
        try {
          if (item.type === "create" && item.entity === "surgery") {
            const { error } = await supabase.from("surgeries").insert(item.payload);
            if (!error && item.id) {
              await removeSyncedItem(item.id);
            }
          }
        } catch {
          // Skip failed items, retry next time
        }
      }

      const remaining = await getPendingSyncItems();
      setPendingSyncCount(remaining.length);
      if (remaining.length < items.length) {
        setLastSyncTime(Date.now());
      }
    } catch {
      // Sync failed, will retry
    }
  }, []);

  // Auto-sync every 30 seconds when online
  useEffect(() => {
    if (isOnline) {
      syncPending();
      syncIntervalRef.current = setInterval(syncPending, 30000);
    }
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [isOnline, syncPending]);

  // Check pending count on mount
  useEffect(() => {
    getPendingSyncItems().then((items) => setPendingSyncCount(items.length));
  }, []);

  // Create surgery offline
  const createSurgeryOffline = useCallback(async (data: Record<string, unknown>) => {
    const id = crypto.randomUUID();
    const surgery = {
      id,
      ...data,
      status: "approved",
      approval_status: "approved",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _offline: true,
    };

    // Cache locally
    await cacheItems(STORES.surgeries, [surgery as { id: string }]);

    // Queue for background sync
    await queueForSync({
      type: "create",
      entity: "surgery",
      entityId: id,
      payload: surgery,
    });

    const items = await getPendingSyncItems();
    setPendingSyncCount(items.length);
    toast.info("Surgery saved offline — will sync when online");
  }, []);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        pendingSyncCount,
        lastSyncTime,
        syncNow: syncPending,
        createSurgeryOffline,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}
