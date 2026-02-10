/* ============================================================
   App Sidebar — Main navigation for the dashboard
   Shows role-based navigation and user info
   ============================================================ */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Stethoscope,
  CalendarDays,
  Package,
  Bell,
  Settings,
  ListOrdered,
  Activity,
  LogOut,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { OfflineStatus } from "@/components/offline-status";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "manager", "surgeon", "scheduler", "nurse"] },
  { href: "/surgeries", label: "Surgeries", icon: Stethoscope, roles: ["admin", "manager", "surgeon", "scheduler", "nurse"] },
  { href: "/schedule", label: "OR Schedule", icon: CalendarDays, roles: ["admin", "manager", "surgeon", "scheduler"] },
  { href: "/priority-queue", label: "Priority Queue", icon: ListOrdered, roles: ["admin", "manager", "scheduler"] },
  { href: "/equipment", label: "Equipment", icon: Package, roles: ["admin", "manager", "nurse"] },
  { href: "/notifications", label: "Notifications", icon: Bell, roles: ["admin", "manager", "surgeon", "scheduler", "nurse"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["admin", "manager", "surgeon", "scheduler", "nurse"] },
];

const roleLabels: Record<string, string> = {
  admin: "Hospital Admin",
  manager: "OR Manager",
  surgeon: "Surgeon",
  scheduler: "Scheduler",
  nurse: "Nurse",
};

const roleColors: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  manager: "bg-purple-100 text-purple-700",
  surgeon: "bg-blue-100 text-blue-700",
  scheduler: "bg-green-100 text-green-700",
  nurse: "bg-cyan-100 text-cyan-700",
};

export function AppSidebar({ userRole, userName }: { userRole: string; userName: string }) {
  const pathname = usePathname();

  // Filter nav items by role
  const visibleItems = navItems.filter(item => item.roles.includes(userRole));

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Brand header */}
      <div className="flex h-16 items-center gap-2 px-6">
        <Activity className="h-7 w-7 text-sidebar-primary" />
        <span className="text-lg font-bold text-sidebar-foreground">
          MedScheduler
        </span>
      </div>

      <Separator />

      {/* User info */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">{userName || "User"}</p>
            <Badge variant="secondary" className={`text-[10px] ${roleColors[userRole] ?? "bg-gray-100 text-gray-700"}`}>
              {roleLabels[userRole] ?? userRole}
            </Badge>
          </div>
        </div>
      </div>

      <Separator />

      {/* Navigation links */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="flex flex-col gap-1">
          {visibleItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link key={href} href={href}>
                <span
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <Separator />

      {/* Offline status indicator */}
      <div className="px-3 py-2">
        <OfflineStatus />
      </div>

      <Separator />

      {/* Sign out button */}
      <div className="p-3">
        <form action="/api/auth/signout" method="POST">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-destructive"
            type="submit"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </form>
      </div>
    </aside>
  );
}
