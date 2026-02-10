/* Recent surgeries table on dashboard */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Surgery } from "@/lib/types";
import Link from "next/link";

const priorityColors: Record<string, string> = {
  emergency: "bg-red-100 text-red-700 border-red-200",
  urgent: "bg-yellow-100 text-yellow-700 border-yellow-200",
  elective: "bg-blue-100 text-blue-700 border-blue-200",
};

const statusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  approved: "bg-blue-100 text-blue-700",
  scheduled: "bg-green-100 text-green-700",
  in_progress: "bg-purple-100 text-purple-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export function RecentSurgeries({ surgeries }: { surgeries: Surgery[] }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold">Recent Surgeries</CardTitle>
        <Link href="/surgeries" className="text-sm text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {surgeries.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            No surgeries found. Create your first surgery request.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Patient</th>
                  <th className="pb-2 font-medium">Procedure</th>
                  <th className="pb-2 font-medium">Priority</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {surgeries.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{s.patient_name}</td>
                    <td className="py-3 text-muted-foreground">{s.procedure_name}</td>
                    <td className="py-3">
                      <Badge variant="outline" className={priorityColors[s.priority]}>
                        {s.priority}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <Badge variant="secondary" className={statusColors[s.status]}>
                        {s.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {s.predicted_duration ?? s.estimated_duration} min
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
