/* ============================================================
   Mobile Sidebar — Hamburger menu sheet for small screens
   Reuses the same navItems as the desktop AppSidebar
   ============================================================ */
"use client";

import { useState } from "react";
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
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/surgeries", label: "Surgeries", icon: Stethoscope },
  { href: "/schedule", label: "OR Schedule", icon: CalendarDays },
  { href: "/priority-queue", label: "Priority Queue", icon: ListOrdered },
  { href: "/equipment", label: "Equipment", icon: Package },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden shrink-0"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-72 p-0 flex flex-col">
        {/* Brand header */}
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center gap-2">
            <Activity className="h-7 w-7 text-primary" />
            <SheetTitle className="text-lg font-bold">MedScheduler</SheetTitle>
          </div>
        </div>

        <Separator />

        {/* Navigation links */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="flex flex-col gap-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive =
                pathname === href || pathname.startsWith(href + "/");
              return (
                <Link key={href} href={href} onClick={() => setOpen(false)}>
                  <span
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" />
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
              <LogOut className="h-5 w-5" />
              Sign Out
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
