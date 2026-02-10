/* OR Utilization bar chart — shows each OR's current status */
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
import type { OperatingRoom } from "@/lib/types";

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const statusScores: Record<string, number> = {
  occupied: 100,
  available: 30,
  maintenance: 0,
  blocked: 0,
};

export function ORUtilizationChart({ rooms }: { rooms: OperatingRoom[] }) {
  const labels = rooms.map((r) => r.name);
  const dataValues = rooms.map((r) => statusScores[r.status] ?? 50);

  const data = {
    labels,
    datasets: [
      {
        label: "Utilization %",
        data: dataValues,
        backgroundColor: rooms.map((r) =>
          r.status === "occupied"
            ? "rgba(16, 137, 211, 0.8)"
            : r.status === "available"
              ? "rgba(18, 177, 209, 0.5)"
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
    },
    scales: {
      y: { beginAtZero: true, max: 100, ticks: { callback: (v: unknown) => `${v}%` } },
      x: { grid: { display: false } },
    },
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">OR Utilization</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-56">
          {rooms.length > 0 ? (
            <Bar data={data} options={options} />
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No operating rooms available
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
