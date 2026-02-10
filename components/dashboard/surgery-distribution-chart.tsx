/* Surgery distribution doughnut chart */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import type { DashboardStats } from "@/lib/types";

ChartJS.register(ArcElement, Tooltip, Legend);

export function SurgeryDistributionChart({ stats }: { stats: DashboardStats }) {
  const data = {
    labels: ["Scheduled", "Completed", "Emergency", "Pending"],
    datasets: [
      {
        data: [
          stats.scheduledToday,
          stats.completedToday,
          stats.emergencyCases,
          stats.pendingApprovals,
        ],
        backgroundColor: [
          "rgba(16, 137, 211, 0.8)",
          "rgba(34, 197, 94, 0.8)",
          "rgba(239, 68, 68, 0.8)",
          "rgba(234, 179, 8, 0.8)",
        ],
        borderWidth: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" as const, labels: { padding: 16, usePointStyle: true } },
    },
    cutout: "65%",
  };

  const total = stats.totalSurgeries;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Surgery Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative h-56">
          <Doughnut data={data} options={options} />
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginBottom: 32 }}>
            <span className="text-3xl font-bold">{total}</span>
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
