/* ============================================================
   App Sidebar — Main navigation for the dashboard
   Uses shadcn-compatible sidebar pattern with icons + links
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/surgeries", label: "Surgeries", icon: Stethoscope },
  { href: "/schedule", label: "OR Schedule", icon: CalendarDays },
  { href: "/priority-queue", label: "Priority Queue", icon: ListOrdered },
  { href: "/equipment", label: "Equipment", icon: Package },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Brand header */}
      <div className="flex h-16 items-center gap-2 px-6">
        <Activity className="h-7 w-7 text-sidebar-primary" />
        <span className="text-lg font-bold text-sidebar-foreground">
          MedScheduler
        </span>
      </div>

      <Separator />

      {/* Navigation links */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="flex flex-col gap-1">
          {navItems.map(({ href, label, icon: Icon }) => {
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
