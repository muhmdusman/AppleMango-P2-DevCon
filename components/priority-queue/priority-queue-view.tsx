/* ============================================================
   Priority Queue View — three-tier Emergency/Urgent/Elective
   Visual queue with aging indicators and auto-escalation
   ============================================================ */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Zap, Clock, ArrowUp, Timer } from "lucide-react";
import type { Surgery } from "@/lib/types";
import { updateSurgeryStatus } from "@/app/actions/surgery";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Props {
  emergency: Surgery[];
  urgent: Surgery[];
  elective: Surgery[];
}

/* Calculate wait time in hours from creation to now */
function getWaitHours(createdAt: string): number {
  return Math.round((Date.now() - new Date(createdAt).getTime()) / 3600000);
}

/* Check if surgery should be escalated based on wait time */
function shouldEscalate(surgery: Surgery): boolean {
  const hours = getWaitHours(surgery.created_at);
  if (surgery.priority === "elective" && hours > 72) return true; // 3 days
  if (surgery.priority === "urgent" && hours > 48) return true;
  return false;
}

/* Aging color based on wait time relative to SLA */
function getAgingColor(priority: string, hours: number): string {
  if (priority === "emergency") return hours > 2 ? "text-red-600" : "text-green-600";
  if (priority === "urgent") return hours > 48 ? "text-red-600" : hours > 24 ? "text-yellow-600" : "text-green-600";
  return hours > 720 ? "text-red-600" : hours > 360 ? "text-yellow-600" : "text-green-600"; // 30 / 15 days
}

function QueueColumn({
  title,
  icon,
  iconColor,
  surgeries,
  sla,
  borderColor,
}: {
  title: string;
  icon: React.ReactNode;
  iconColor: string;
  surgeries: Surgery[];
  sla: string;
  borderColor: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSchedule = (id: string) => {
    startTransition(async () => {
      const res = await updateSurgeryStatus(id, "scheduled");
      if (res.error) toast.error(res.error);
      else toast.success("Moved to scheduled");
      router.refresh();
    });
  };

  const activeSurgeries = surgeries.filter(s =>
    !["completed", "cancelled"].includes(s.status)
  );

  return (
    <Card className={`border-0 shadow-sm border-t-4 ${borderColor}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <span className={iconColor}>{icon}</span>
            {title}
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {activeSurgeries.length} active
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">SLA: {sla}</p>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
        {activeSurgeries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No active cases</p>
        ) : (
          activeSurgeries.map((s, idx) => {
            const waitHours = getWaitHours(s.created_at);
            const escalate = shouldEscalate(s);
            const agingColor = getAgingColor(s.priority, waitHours);

            return (
              <div
                key={s.id}
                className={`rounded-lg border p-3 space-y-2 ${escalate ? "border-red-300 bg-red-50/50" : ""}`}
              >
                {/* Position & patient */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{s.patient_name}</p>
                      <p className="text-xs text-muted-foreground">{s.procedure_name}</p>
                    </div>
                  </div>
                  {escalate && (
                    <Badge variant="destructive" className="text-[10px] gap-1">
                      <ArrowUp className="h-2.5 w-2.5" /> Escalate
                    </Badge>
                  )}
                </div>

                {/* Wait time & aging */}
                <div className="flex items-center justify-between text-xs">
                  <span className={`flex items-center gap-1 ${agingColor}`}>
                    <Timer className="h-3 w-3" />
                    Waiting: {waitHours < 24 ? `${waitHours}h` : `${Math.round(waitHours / 24)}d`}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {s.status.replace("_", " ")}
                  </Badge>
                </div>

                {/* Complexity bar */}
                <div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                    <span>Complexity</span>
                    <span>{s.complexity}/5</span>
                  </div>
                  <Progress value={s.complexity * 20} className="h-1" />
                </div>

                {/* Duration */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {s.predicted_duration ?? s.estimated_duration} min
                  {s.predicted_duration && <span className="text-primary"> (AI)</span>}
                </div>

                {/* Action */}
                {s.status === "approved" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-7 text-xs"
                    onClick={() => handleSchedule(s.id)}
                    disabled={isPending}
                  >
                    Schedule Now
                  </Button>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

export function PriorityQueueView({ emergency, urgent, elective }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <QueueColumn
        title="Emergency"
        icon={<Zap className="h-5 w-5" />}
        iconColor="text-red-500"
        surgeries={emergency}
        sla="Within 2 hours"
        borderColor="border-t-red-500"
      />
      <QueueColumn
        title="Urgent"
        icon={<AlertTriangle className="h-5 w-5" />}
        iconColor="text-yellow-500"
        surgeries={urgent}
        sla="Within 24-48 hours"
        borderColor="border-t-yellow-500"
      />
      <QueueColumn
        title="Elective"
        icon={<Clock className="h-5 w-5" />}
        iconColor="text-blue-500"
        surgeries={elective}
        sla="Within 30 days"
        borderColor="border-t-blue-500"
      />
    </div>
  );
}
