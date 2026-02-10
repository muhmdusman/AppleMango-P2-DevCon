/* Stats cards row — 4 key metrics at top of dashboard */
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, Clock, AlertTriangle, Activity } from "lucide-react";
import type { DashboardStats } from "@/lib/types";

const cards: { key: keyof DashboardStats; label: string; icon: typeof CalendarDays; color: string; suffix?: string }[] = [
  { key: "scheduledToday", label: "Scheduled Today", icon: CalendarDays, color: "text-primary" },
  { key: "emergencyCases", label: "Emergency Cases", icon: AlertTriangle, color: "text-destructive" },
  { key: "orUtilization", label: "OR Utilization", icon: Activity, color: "text-accent", suffix: "%" },
  { key: "pendingApprovals", label: "Pending Approvals", icon: Clock, color: "text-yellow-500" },
];

export function StatsCards({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ key, label, icon: Icon, color, suffix }) => (
        <Card key={key} className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className={`rounded-xl bg-muted p-3 ${color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold">
                {stats[key]}
                {suffix ?? ""}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
