/* OR Utilization bar chart — dynamic, computed from actual schedule slots */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import type { OperatingRoom, ScheduleSlot } from "@/lib/types";

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Operating hours: 7 AM to 8 PM = 13 hours
const OPERATING_HOURS = 13;
const OPERATING_MS = OPERATING_HOURS * 60 * 60 * 1000;

interface Props {
  rooms: OperatingRoom[];
  slots: ScheduleSlot[];
}

export function ORUtilizationChart({ rooms, slots }: Props) {
  const labels = rooms.map((r) => r.name.replace(/\s*\(.*\)/, ""));

  // Calculate actual utilization per room from schedule slots
  const dataValues = rooms.map((room) => {
    if (room.status === "maintenance" || room.status === "blocked") return 0;

    const roomSlots = slots.filter(
      (s) => s.or_id === room.id && s.slot_type === "surgery"
    );

    if (roomSlots.length === 0) {
      // If room is marked occupied but has no slots, show a base utilization
      return room.status === "occupied" ? 15 : 0;
    }

    // Sum total surgery time for this OR
    const totalMs = roomSlots.reduce((sum, s) => {
      const start = new Date(s.start_time).getTime();
      const end = new Date(s.end_time).getTime();
      return sum + Math.max(0, end - start);
    }, 0);

    return Math.min(100, Math.round((totalMs / OPERATING_MS) * 100));
  });

  const avgUtilization = dataValues.length > 0
    ? Math.round(dataValues.reduce((a, b) => a + b, 0) / dataValues.length)
    : 0;

  const data = {
    labels,
    datasets: [
      {
        label: "Utilization %",
        data: dataValues,
        backgroundColor: dataValues.map((v) =>
          v >= 70
            ? "rgba(16, 137, 211, 0.85)"
            : v >= 40
              ? "rgba(18, 177, 209, 0.6)"
              : v > 0
                ? "rgba(250, 204, 21, 0.6)"
                : "rgba(148, 163, 184, 0.4)"
        ),
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: { y: number | null } }) => `${ctx.parsed.y ?? 0}% utilized`,
        },
      },
    },
    scales: {
      y: { beginAtZero: true, max: 100, ticks: { callback: (v: unknown) => `${v}%` } },
      x: { grid: { display: false } },
    },
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">OR Utilization</CardTitle>
          <span className="text-xs text-muted-foreground">
            Avg: {avgUtilization}% &bull; {slots.filter(s => s.slot_type === "surgery").length} surgeries today
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-56">
          {rooms.length > 0 ? (
            <Bar data={data} options={options} />
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No operating rooms configured
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
