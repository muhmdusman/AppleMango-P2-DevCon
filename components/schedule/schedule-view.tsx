/* ============================================================
   Schedule View — Multi-OR Gantt chart with drag-and-drop
   24-hour timeline with 15-minute increments
   Color coding: green/yellow/red/blue/grey
   Supports: drag unscheduled → timeline, re-drag placed blocks,
             CSV export, AI schedule scoring
   ============================================================ */
"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, AlertTriangle, Clock, Zap, Download, RefreshCw } from "lucide-react";
import type { OperatingRoom, ScheduleSlot, Surgery } from "@/lib/types";
import { scheduleSurgery } from "@/app/actions/surgery";
import { checkConstraints } from "@/lib/scheduler";
import { scoreScheduleQuality } from "@/lib/ai";
import { toast } from "sonner";

// Hours displayed on the Gantt chart (7 AM - 20 PM)
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);
const SLOT_WIDTH = 60; // pixels per hour
const GANTT_START_HOUR = 7;

// Color coding per scope requirements
const priorityBarColors: Record<string, string> = {
  emergency: "bg-blue-500",
  urgent: "bg-yellow-500",
  elective: "bg-green-500",
};

const slotTypeColors: Record<string, string> = {
  setup: "bg-gray-300",
  surgery: "",   // uses priority color
  cleanup: "bg-gray-300",
};

interface Props {
  rooms: OperatingRoom[];
  slots: ScheduleSlot[];
  unscheduledSurgeries: Surgery[];
  selectedDate: string;
  hospitalId: string;
}

export function ScheduleView({ rooms, slots, unscheduledSurgeries, selectedDate, hospitalId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dragSurgery, setDragSurgery] = useState<Surgery | null>(null);
  const [dragFromSlot, setDragFromSlot] = useState<string | null>(null);

  // Navigate between dates
  const changeDate = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    router.push(`/schedule?date=${d.toISOString().split("T")[0]}`);
  };

  // AI schedule quality score
  const scheduleScore = scoreScheduleQuality(
    slots.filter(s => s.slot_type === "surgery").map(s => ({
      start: new Date(s.start_time),
      end: new Date(s.end_time),
      priority: s.surgery?.priority ?? "elective",
      procedureType: s.surgery?.procedure_type ?? undefined,
      complexity: s.surgery?.complexity,
    }))
  );

  // CSV export
  const exportCSV = () => {
    const headers = ["Surgery", "Patient", "OR", "Priority", "Start", "End", "Duration (min)", "Status"];
    const rows = slots
      .filter(s => s.slot_type === "surgery")
      .map(s => [
        s.surgery?.procedure_name ?? "",
        s.surgery?.patient_name ?? "",
        rooms.find(r => r.id === s.or_id)?.name ?? "",
        s.surgery?.priority ?? "",
        new Date(s.start_time).toLocaleString(),
        new Date(s.end_time).toLocaleString(),
        String(Math.round((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 60000)),
        s.surgery?.status ?? "",
      ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `schedule-${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Schedule exported as CSV");
  };

  // Handle drop on a time slot (works for both new and re-dragged surgeries)
  const handleDrop = useCallback((orId: string, hour: number) => {
    if (!dragSurgery) return;

    const start = new Date(`${selectedDate}T${String(hour).padStart(2, "0")}:00:00`);
    const end = new Date(start.getTime() + dragSurgery.estimated_duration * 60000);

    // Check constraints before scheduling (exclude current slot if re-dragging)
    const or = rooms.find(r => r.id === orId);
    const filteredSlots = dragFromSlot
      ? slots.filter(s => s.surgery_id !== dragSurgery.id)
      : slots;

    if (or) {
      const result = checkConstraints(dragSurgery, or, start, end, filteredSlots);
      if (result.hasConflict) {
        toast.error(`Conflict: ${result.hardViolations.join(", ")}`);
        return;
      }
      if (result.softViolations.length > 0) {
        toast.warning(`Warning: ${result.softViolations.join(", ")}`);
      }
    }

    startTransition(async () => {
      const res = await scheduleSurgery(dragSurgery.id, orId, start.toISOString(), end.toISOString());
      if (res.error) toast.error(res.error);
      else {
        toast.success(`${dragFromSlot ? "Rescheduled" : "Scheduled"} ${dragSurgery.procedure_name} in ${or?.name}`);
        router.refresh();
      }
    });

    setDragSurgery(null);
    setDragFromSlot(null);
  }, [dragSurgery, dragFromSlot, selectedDate, rooms, slots, router]);

  return (
    <div className="space-y-4">
      {/* Date navigation + controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => changeDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => router.push(`/schedule?date=${e.target.value}`)}
            className="w-40"
          />
          <Button variant="outline" size="icon" onClick={() => changeDate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => router.push(`/schedule?date=${new Date().toISOString().split("T")[0]}`)}>
            Today
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {/* AI Score Badge */}
          <Badge variant={scheduleScore.grade === "A" ? "default" : scheduleScore.grade === "B" ? "secondary" : "destructive"} className="text-xs gap-1">
            AI Score: {scheduleScore.score}/100 ({scheduleScore.grade})
          </Badge>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="icon" onClick={() => router.refresh()} disabled={isPending}>
            <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Schedule issues from AI */}
      {scheduleScore.issues.length > 0 && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 space-y-1">
          <p className="text-xs font-medium text-yellow-800 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> AI Recommendations</p>
          {scheduleScore.recommendations.map((r, i) => (
            <p key={i} className="text-xs text-yellow-700">• {r}</p>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        {/* Gantt Chart */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">OR Timeline — {selectedDate}</CardTitle>
              <span className="text-xs text-muted-foreground">
                {slots.filter(s => s.slot_type === "surgery").length} surgeries • Disruption: {scheduleScore.disruptionProbability}%
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div style={{ minWidth: HOURS.length * SLOT_WIDTH + 120 }}>
                {/* Time header */}
                <div className="flex border-b bg-muted/30">
                  <div className="w-[120px] shrink-0 p-2 text-xs font-medium text-muted-foreground">OR</div>
                  {HOURS.map(h => (
                    <div key={h} className="border-l p-2 text-xs text-muted-foreground text-center" style={{ width: SLOT_WIDTH }}>
                      {String(h).padStart(2, "0")}:00
                    </div>
                  ))}
                </div>

                {/* OR Rows */}
                {rooms.map(room => {
                  const roomSlots = slots.filter(s => s.or_id === room.id);
                  return (
                    <div
                      key={room.id}
                      className="flex border-b hover:bg-muted/20 relative"
                      style={{ minHeight: 56 }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left - 120;
                        const hour = Math.floor(x / SLOT_WIDTH) + GANTT_START_HOUR;
                        handleDrop(room.id, Math.max(GANTT_START_HOUR, Math.min(20, hour)));
                      }}
                    >
                      {/* Room label */}
                      <div className="w-[120px] shrink-0 flex items-center px-3 text-xs font-medium border-r">
                        <div>
                          <p>{room.name}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{room.room_type}</p>
                        </div>
                      </div>

                      {/* Timeline area */}
                      <div className="relative flex-1" style={{ width: HOURS.length * SLOT_WIDTH }}>
                        {/* Grid lines */}
                        {HOURS.map(h => (
                          <div key={h} className="absolute top-0 bottom-0 border-l border-dashed border-muted" style={{ left: (h - GANTT_START_HOUR) * SLOT_WIDTH }} />
                        ))}

                        {/* Surgery blocks — draggable for re-scheduling */}
                        {roomSlots.map(slot => {
                          const start = new Date(slot.start_time);
                          const end = new Date(slot.end_time);
                          const startHour = start.getHours() + start.getMinutes() / 60;
                          const endHour = end.getHours() + end.getMinutes() / 60;
                          const left = (startHour - GANTT_START_HOUR) * SLOT_WIDTH;
                          const width = (endHour - startHour) * SLOT_WIDTH;

                          const bgColor = slot.slot_type !== "surgery"
                            ? slotTypeColors[slot.slot_type]
                            : priorityBarColors[slot.surgery?.priority ?? "elective"];

                          const isDraggableSurgery = slot.slot_type === "surgery" && slot.surgery;

                          return (
                            <div
                              key={slot.id}
                              draggable={!!isDraggableSurgery}
                              onDragStart={() => {
                                if (isDraggableSurgery && slot.surgery) {
                                  setDragSurgery(slot.surgery);
                                  setDragFromSlot(slot.id);
                                }
                              }}
                              onDragEnd={() => {
                                setDragSurgery(null);
                                setDragFromSlot(null);
                              }}
                              className={`absolute top-1 bottom-1 rounded ${bgColor} flex items-center px-1.5 text-[10px] text-white font-medium overflow-hidden transition-opacity ${isDraggableSurgery ? "cursor-grab active:cursor-grabbing hover:opacity-80 hover:ring-2 hover:ring-white/50" : "cursor-default"}`}
                              style={{ left: Math.max(0, left), width: Math.max(20, width) }}
                              title={`${slot.surgery?.procedure_name ?? slot.slot_type} — ${slot.surgery?.patient_name ?? ""}\n${isDraggableSurgery ? "Drag to reschedule" : ""}`}
                            >
                              {slot.slot_type === "surgery" && (
                                <span className="truncate">
                                  {slot.surgery?.procedure_name}
                                </span>
                              )}
                            </div>
                          );
                        })}

                        {/* Room status overlay */}
                        {room.status === "maintenance" && (
                          <div className="absolute inset-0 bg-gray-200/60 flex items-center justify-center">
                            <span className="text-xs text-gray-500 font-medium">Maintenance</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="flex gap-4 p-3 border-t text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-green-500" /> Elective</span>
              <span className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-yellow-500" /> Urgent</span>
              <span className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-blue-500" /> Emergency</span>
              <span className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-gray-300" /> Setup/Cleanup</span>
            </div>
          </CardContent>
        </Card>

        {/* Unscheduled surgeries sidebar (drag source) */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Unscheduled ({unscheduledSurgeries.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
            {unscheduledSurgeries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">All surgeries scheduled</p>
            ) : (
              unscheduledSurgeries.map(s => (
                <div
                  key={s.id}
                  draggable
                  onDragStart={() => setDragSurgery(s)}
                  onDragEnd={() => setDragSurgery(null)}
                  className="rounded-lg border bg-card p-3 cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate">{s.procedure_name}</span>
                    <Badge variant="outline" className={`text-[10px] ${priorityBarColors[s.priority]}`}>
                      {s.priority === "emergency" && <Zap className="h-2.5 w-2.5 mr-0.5" />}
                      {s.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.patient_name}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {s.predicted_duration ?? s.estimated_duration} min
                    {s.predicted_duration && <span className="text-primary">(AI)</span>}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
