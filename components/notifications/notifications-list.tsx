/* ============================================================
   Notifications List — filterable alert center with auto-refresh
   ============================================================ */
"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Bell, AlertTriangle, CheckCircle, Info, Zap, Check, Download, RefreshCw } from "lucide-react";
import type { Notification } from "@/lib/types";
import { markNotificationRead, markAllNotificationsRead } from "@/app/actions/surgery";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const typeIcons: Record<string, React.ReactNode> = {
  info: <Info className="h-4 w-4 text-blue-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  error: <AlertTriangle className="h-4 w-4 text-red-500" />,
  success: <CheckCircle className="h-4 w-4 text-green-500" />,
  emergency: <Zap className="h-4 w-4 text-red-600" />,
};

const typeBadgeColors: Record<string, string> = {
  info: "bg-blue-100 text-blue-700",
  warning: "bg-yellow-100 text-yellow-700",
  error: "bg-red-100 text-red-700",
  success: "bg-green-100 text-green-700",
  emergency: "bg-red-100 text-red-700",
};

function exportNotificationsCSV(notifications: Notification[]) {
  const headers = ["Title", "Message", "Type", "Category", "Read", "Created"];
  const rows = notifications.map(n => [
    n.title, n.message, n.type, n.category,
    n.is_read ? "Yes" : "No", new Date(n.created_at).toLocaleString(),
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `notifications-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Notifications exported as CSV");
}

interface Props {
  notifications: Notification[];
  hospitalId: string;
}

export function NotificationsList({ notifications, hospitalId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState("all");

  // Auto-refresh every 30 seconds for real-time feel
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 30000);
    return () => clearInterval(interval);
  }, [router]);

  const filtered = filter === "all"
    ? notifications
    : filter === "unread"
      ? notifications.filter(n => !n.is_read)
      : notifications.filter(n => n.type === filter);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleMarkRead = (id: string) => {
    startTransition(async () => {
      await markNotificationRead(id);
      router.refresh();
    });
  };

  const handleMarkAllRead = () => {
    startTransition(async () => {
      await markAllNotificationsRead(hospitalId);
      toast.success("All notifications marked as read");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({notifications.length})</SelectItem>
              <SelectItem value="unread">Unread ({unreadCount})</SelectItem>
              <SelectItem value="emergency">Emergency</SelectItem>
              <SelectItem value="warning">Warnings</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => exportNotificationsCSV(filtered)}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.refresh()} disabled={isPending} className="h-8 w-8">
            <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={isPending}>
              <Check className="mr-2 h-3.5 w-3.5" /> Mark All Read
            </Button>
          )}
        </div>
      </div>

      {/* Notification items */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <Bell className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No notifications</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map(n => (
            <Card
              key={n.id}
              className={`border-0 shadow-sm transition-colors ${!n.is_read ? "bg-primary/5 border-l-4 border-l-primary" : ""}`}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <div className="mt-0.5">{typeIcons[n.type]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium">{n.title}</p>
                    <Badge variant="secondary" className={`text-[10px] ${typeBadgeColors[n.type]}`}>
                      {n.type}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">{n.category}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
                {!n.is_read && (
                  <Button variant="ghost" size="sm" className="text-xs h-7 shrink-0" onClick={() => handleMarkRead(n.id)}>
                    Mark Read
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
