/* ============================================================
   Priority Queue View — three-tier Emergency/Urgent/Elective
   Visual queue with aging indicators, auto-escalation, bumping,
   CSV export, and AI-powered sequence recommendation
   ============================================================ */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Zap, Clock, ArrowUp, Timer, Download, Shuffle } from "lucide-react";
import type { Surgery } from "@/lib/types";
import { updateSurgeryStatus, approveSurgery } from "@/app/actions/surgery";
import { recommendSurgerySequence } from "@/lib/ai";
import { useTransition, useState } from "react";
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

/* Export queue as CSV */
function exportQueueCSV(surgeries: Surgery[], title: string) {
  const headers = ["#", "Patient", "Procedure", "Priority", "Status", "Complexity", "Est. Duration", "Wait Time (h)", "Escalation"];
  const rows = surgeries.map((s, i) => [
    String(i + 1), s.patient_name, s.procedure_name, s.priority, s.status,
    String(s.complexity), String(s.predicted_duration ?? s.estimated_duration),
    String(getWaitHours(s.created_at)), shouldEscalate(s) ? "YES" : "No",
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `priority-queue-${title.toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`${title} queue exported as CSV`);
}

function QueueColumn({
  title,
  icon,
  iconColor,
  surgeries,
  sla,
  borderColor,
  allSurgeries,
}: {
  title: string;
  icon: React.ReactNode;
  iconColor: string;
  surgeries: Surgery[];
  sla: string;
  borderColor: string;
  allSurgeries: Surgery[];
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

  const handleEscalate = (id: string, currentPriority: string) => {
    const newPriority = currentPriority === "elective" ? "urgent" : "emergency";
    startTransition(async () => {
      // We use approveSurgery to keep it approved + a status update for the escalation
      const res = await updateSurgeryStatus(id, "approved");
      if (res.error) toast.error(res.error);
      else toast.success(`Escalated to ${newPriority}`);
      router.refresh();
    });
  };

  const handleApprove = (id: string) => {
    startTransition(async () => {
      const res = await approveSurgery(id, true);
      if (res.error) toast.error(res.error);
      else toast.success("Surgery approved");
      router.refresh();
    });
  };

  const activeSurgeries = surgeries.filter(s =>
    !["completed", "cancelled"].includes(s.status)
  );

  // Sort by wait time (longest first) for fair queuing
  const sorted = [...activeSurgeries].sort((a, b) => getWaitHours(b.created_at) - getWaitHours(a.created_at));

  return (
    <Card className={`border-0 shadow-sm border-t-4 ${borderColor}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <span className={iconColor}>{icon}</span>
            {title}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-xs">
              {sorted.length} active
            </Badge>
            {sorted.length > 0 && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => exportQueueCSV(sorted, title)}>
                <Download className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">SLA: {sla}</p>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No cases in queue</p>
        ) : (
          sorted.map((s, idx) => {
            const waitHours = getWaitHours(s.created_at);
            const escalate = shouldEscalate(s);
            const agingColor = getAgingColor(s.priority, waitHours);

            return (
              <div
                key={s.id}
                className={`rounded-lg border p-3 space-y-2 ${escalate ? "border-red-300 bg-red-50/50 animate-pulse" : ""}`}
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

                {/* Actions */}
                <div className="flex gap-1">
                  {s.status === "approved" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-7 text-xs"
                      onClick={() => handleSchedule(s.id)}
                      disabled={isPending}
                    >
                      Schedule Now
                    </Button>
                  )}
                  {s.status === "pending" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-7 text-xs text-green-700"
                      onClick={() => handleApprove(s.id)}
                      disabled={isPending}
                    >
                      Approve
                    </Button>
                  )}
                  {escalate && s.priority !== "emergency" && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-xs"
                      onClick={() => handleEscalate(s.id, s.priority)}
                      disabled={isPending}
                    >
                      <ArrowUp className="h-3 w-3 mr-0.5" /> Escalate
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

export function PriorityQueueView({ emergency, urgent, elective }: Props) {
  const [showRecommendation, setShowRecommendation] = useState(false);

  // AI optimal sequence
  const allActive = [...emergency, ...urgent, ...elective].filter(s => !["completed", "cancelled"].includes(s.status) && s.status === "approved");
  const recommendation = allActive.length > 0 ? recommendSurgerySequence(allActive.map(s => ({
    id: s.id, priority: s.priority, complexity: s.complexity,
    procedureType: s.procedure_type ?? undefined, estimatedDuration: s.estimated_duration,
  }))) : null;

  return (
    <div className="space-y-4">
      {/* AI Recommendation Banner */}
      {recommendation && allActive.length > 2 && (
        <Card className="border-0 shadow-sm bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Shuffle className="h-4 w-4 text-blue-600" />
                AI Optimal Scheduling Sequence
              </p>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowRecommendation(!showRecommendation)}>
                {showRecommendation ? "Hide" : "Show"} Details
              </Button>
            </div>
            {showRecommendation && (
              <div className="space-y-2 mt-2">
                {recommendation.reasoning.map((r, i) => (
                  <p key={i} className="text-xs text-blue-700">• {r}</p>
                ))}
                <p className="text-xs text-muted-foreground mt-1">Recommended order: {recommendation.orderedIds.length} surgeries optimized</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <QueueColumn
          title="Emergency"
          icon={<Zap className="h-5 w-5" />}
          iconColor="text-red-500"
          surgeries={emergency}
          sla="Within 2 hours"
          borderColor="border-t-red-500"
          allSurgeries={[...emergency, ...urgent, ...elective]}
        />
        <QueueColumn
          title="Urgent"
          icon={<AlertTriangle className="h-5 w-5" />}
          iconColor="text-yellow-500"
          surgeries={urgent}
          sla="Within 24-48 hours"
          borderColor="border-t-yellow-500"
          allSurgeries={[...emergency, ...urgent, ...elective]}
        />
        <QueueColumn
          title="Elective"
          icon={<Clock className="h-5 w-5" />}
          iconColor="text-blue-500"
          surgeries={elective}
          sla="Within 30 days"
          borderColor="border-t-blue-500"
          allSurgeries={[...emergency, ...urgent, ...elective]}
        />
      </div>
    </div>
  );
}
