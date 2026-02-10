/* ============================================================
   Dashboard top header bar with search, notifications, user menu
   ============================================================ */
"use client";

import { Bell, Search, Wifi, WifiOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import { signOut } from "@/app/actions/auth";
import Link from "next/link";

export function DashboardHeader({
  userEmail,
  notificationCount = 0,
}: {
  userEmail?: string;
  notificationCount?: number;
}) {
  const [online, setOnline] = useState(true);

  // Track online/offline status
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : "U";

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      {/* Search bar */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search surgeries, patients, staff..."
          className="pl-9 bg-muted/50 border-0"
        />
      </div>

      <div className="flex items-center gap-3">
        {/* Online/Offline indicator */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {online ? (
            <><Wifi className="h-3.5 w-3.5 text-green-500" /> Online</>
          ) : (
            <><WifiOff className="h-3.5 w-3.5 text-destructive" /> Offline</>
          )}
        </div>

        {/* Notifications bell */}
        <Link href="/notifications">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {notificationCount > 0 && (
              <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-[10px] flex items-center justify-center bg-destructive">
                {notificationCount}
              </Badge>
            )}
          </Button>
        </Link>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
              {userEmail}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
