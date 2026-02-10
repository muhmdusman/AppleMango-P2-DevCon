/* ============================================================
   Dashboard top header bar with search, notifications, user menu
   Includes hamburger menu for mobile via MobileSidebar
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
import { MobileSidebar } from "@/components/mobile-sidebar";

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
    <header className="flex h-14 md:h-16 items-center justify-between border-b border-border bg-card px-3 md:px-6 gap-2 md:gap-4">
      {/* Hamburger menu — mobile only */}
      <MobileSidebar />

      {/* Search bar */}
      <div className="relative flex-1 max-w-sm hidden sm:block">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search..."
          className="pl-9 bg-muted/50 border-0"
        />
      </div>

      {/* Spacer on mobile to push items right */}
      <div className="flex-1 sm:hidden" />

      <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
        {/* Online/Offline indicator */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
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
