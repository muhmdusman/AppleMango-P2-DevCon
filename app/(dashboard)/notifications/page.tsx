/* Notifications Page — real-time alert center */
import { getDefaultHospitalId, getNotifications } from "@/lib/data";
import { redirect } from "next/navigation";
import { NotificationsList } from "@/components/notifications/notifications-list";

export default async function NotificationsPage() {
  const hospitalId = await getDefaultHospitalId();
  if (!hospitalId) redirect("/dashboard");

  const notifications = await getNotifications(hospitalId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
      </div>
      <NotificationsList notifications={notifications} hospitalId={hospitalId} />
    </div>
  );
}
