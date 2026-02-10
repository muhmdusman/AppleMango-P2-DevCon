/* Offline Status Indicator — shows online/offline status + pending sync count */
"use client";

import { useOffline } from "@/components/providers/offline-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wifi, WifiOff, RefreshCw, Cloud } from "lucide-react";
import { toast } from "sonner";

export function OfflineStatus() {
  const { isOnline, pendingSyncCount, syncNow } = useOffline();

  const handleSync = async () => {
    toast.info("Syncing...");
    await syncNow();
    toast.success("Sync complete");
  };

  return (
    <div className="flex items-center gap-2">
      {/* Online/Offline indicator */}
      <Badge
        variant={isOnline ? "default" : "destructive"}
        className="gap-1 text-[10px] py-0.5"
      >
        {isOnline ? (
          <>
            <Wifi className="h-3 w-3" />
            Online
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3" />
            Offline
          </>
        )}
      </Badge>

      {/* Pending sync count */}
      {pendingSyncCount > 0 && (
        <Badge variant="secondary" className="gap-1 text-[10px] py-0.5">
          <Cloud className="h-3 w-3" />
          {pendingSyncCount} pending
        </Badge>
      )}

      {/* Manual sync button */}
      {pendingSyncCount > 0 && isOnline && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleSync}
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
