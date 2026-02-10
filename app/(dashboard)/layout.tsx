/* ============================================================
   Dashboard Layout — wraps all authenticated pages
   Sidebar + Header + Main content area
   Passes user role info for role-based access
   ============================================================ */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { Toaster } from "@/components/ui/sonner";
import { getUnreadNotificationCount, getDefaultHospitalId, getUserProfile } from "@/lib/data";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect to login if not authenticated
  if (!user) redirect("/login");

  // Get user profile with role and notification count
  const [profile, hospitalId] = await Promise.all([
    getUserProfile(),
    getDefaultHospitalId(),
  ]);
  const notifCount = hospitalId ? await getUnreadNotificationCount(hospitalId) : 0;

  const userRole = profile?.role ?? "scheduler";
  const userName = profile?.fullName ?? user.email ?? "";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar navigation */}
      <AppSidebar userRole={userRole} userName={userName} />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader
          userEmail={user.email}
          notificationCount={notifCount}
          userRole={userRole}
          userName={userName}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      <Toaster position="top-right" />
    </div>
  );
}
