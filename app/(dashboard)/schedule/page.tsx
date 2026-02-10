/* OR Schedule — Interactive Gantt chart with drag-and-drop */
import { getDefaultHospitalId, getOperatingRooms, getScheduleSlots, getSurgeries } from "@/lib/data";
import { redirect } from "next/navigation";
import { ScheduleView } from "@/components/schedule/schedule-view";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const hospitalId = await getDefaultHospitalId();
  if (!hospitalId) redirect("/dashboard");

  const params = await searchParams;
  const date = params.date ?? new Date().toISOString().split("T")[0];

  const [rooms, slots, unscheduled] = await Promise.all([
    getOperatingRooms(hospitalId),
    getScheduleSlots(hospitalId, date),
    getSurgeries(hospitalId, { status: "approved", pageSize: 50 }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">OR Schedule</h1>
      </div>
      <ScheduleView
        rooms={rooms}
        slots={slots}
        unscheduledSurgeries={unscheduled.data}
        selectedDate={date}
        hospitalId={hospitalId}
      />
    </div>
  );
}
