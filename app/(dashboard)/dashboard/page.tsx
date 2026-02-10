/* Dashboard — analytics overview with stats and charts */
import { Suspense } from "react";
import { getDashboardStats, getDefaultHospitalId, getSurgeries, getOperatingRooms } from "@/lib/data";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentSurgeries } from "@/components/dashboard/recent-surgeries";
import { ORUtilizationChart } from "@/components/dashboard/or-utilization-chart";
import { SurgeryDistributionChart } from "@/components/dashboard/surgery-distribution-chart";
import { SeedDataBanner } from "@/components/dashboard/seed-data-banner";

export default async function DashboardPage() {
  const hospitalId = await getDefaultHospitalId();
  if (!hospitalId) return <SeedDataBanner />;

  const [stats, surgeriesRes, rooms] = await Promise.all([
    getDashboardStats(hospitalId),
    getSurgeries(hospitalId, { pageSize: 5 }),
    getOperatingRooms(hospitalId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      </div>
      <Suspense fallback={<div className="h-28 animate-pulse rounded-lg bg-muted" />}>
        <StatsCards stats={stats} />
      </Suspense>
      <div className="grid gap-6 md:grid-cols-2">
        <Suspense fallback={<div className="h-72 animate-pulse rounded-lg bg-muted" />}>
          <ORUtilizationChart rooms={rooms} />
        </Suspense>
        <Suspense fallback={<div className="h-72 animate-pulse rounded-lg bg-muted" />}>
          <SurgeryDistributionChart stats={stats} />
        </Suspense>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted" />}>
        <RecentSurgeries surgeries={surgeriesRes.data} />
      </Suspense>
    </div>
  );
}
