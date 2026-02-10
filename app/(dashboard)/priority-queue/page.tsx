/* Priority Queue Page — three-tier priority visualization */
import { getDefaultHospitalId, getSurgeries } from "@/lib/data";
import { redirect } from "next/navigation";
import { PriorityQueueView } from "@/components/priority-queue/priority-queue-view";

export default async function PriorityQueuePage() {
  const hospitalId = await getDefaultHospitalId();
  if (!hospitalId) redirect("/dashboard");

  // Fetch all active surgeries grouped by priority
  const [emergency, urgent, elective] = await Promise.all([
    getSurgeries(hospitalId, { priority: "emergency", pageSize: 50 }),
    getSurgeries(hospitalId, { priority: "urgent", pageSize: 50 }),
    getSurgeries(hospitalId, { priority: "elective", pageSize: 50 }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Priority Queue</h1>
        <p className="text-sm text-muted-foreground">Dynamic three-tier priority system with auto-escalation</p>
      </div>
      <PriorityQueueView
        emergency={emergency.data}
        urgent={urgent.data}
        elective={elective.data}
      />
    </div>
  );
}
