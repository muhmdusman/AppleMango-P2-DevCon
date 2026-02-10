/* Surgeries Page — CRUD, filtering, approval workflow */
import { Suspense } from "react";
import { getDefaultHospitalId, getSurgeries, getStaff } from "@/lib/data";
import { SurgeryList } from "@/components/surgeries/surgery-list";
import { redirect } from "next/navigation";

export default async function SurgeriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priority?: string; search?: string; page?: string }>;
}) {
  const hospitalId = await getDefaultHospitalId();
  if (!hospitalId) redirect("/dashboard");

  const params = await searchParams;
  const page = parseInt(params.page ?? "1");

  const [surgeriesRes, surgeons] = await Promise.all([
    getSurgeries(hospitalId, {
      status: params.status,
      priority: params.priority,
      search: params.search,
      page,
      pageSize: 20,
    }),
    getStaff(hospitalId, "surgeon"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Surgeries</h1>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted" />}>
        <SurgeryList
          surgeries={surgeriesRes.data}
          totalCount={surgeriesRes.count}
          currentPage={page}
          hospitalId={hospitalId}
          surgeons={surgeons}
          filters={params}
        />
      </Suspense>
    </div>
  );
}
