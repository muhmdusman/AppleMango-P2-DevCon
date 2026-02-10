/* Equipment Management — inventory, sterilization, maintenance */
import { getDefaultHospitalId, getEquipment } from "@/lib/data";
import { redirect } from "next/navigation";
import { EquipmentList } from "@/components/equipment/equipment-list";

export default async function EquipmentPage() {
  const hospitalId = await getDefaultHospitalId();
  if (!hospitalId) redirect("/dashboard");

  const equipment = await getEquipment(hospitalId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Equipment</h1>
      </div>
      <EquipmentList equipment={equipment} hospitalId={hospitalId} />
    </div>
  );
}
