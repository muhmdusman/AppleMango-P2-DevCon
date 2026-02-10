/* ============================================================
   Dashboard Layout — wraps all authenticated pages
   Sidebar + Header + Main content area
   ============================================================ */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { Toaster } from "@/components/ui/sonner";
import { getUnreadNotificationCount, getDefaultHospitalId } from "@/lib/data";
import { DEV_USER, shouldBypassAuth } from "@/lib/auth/devUser";
import { DevAuthBanner } from "@/components/dev-auth-banner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 🔓 DEV BYPASS - Use fake dev user in development
  if (shouldBypassAuth()) {
    const hospitalId = await getDefaultHospitalId();
    const notifCount = hospitalId ? await getUnreadNotificationCount(hospitalId) : 0;

    return (
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Sidebar navigation */}
        <AppSidebar />

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <DashboardHeader
            userEmail={DEV_USER.email}
            notificationCount={notifCount}
          />
          <DevAuthBanner />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>

        <Toaster position="top-right" />
      </div>
    );
  }

  // 🔐 REAL AUTH - Normal authentication flow
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect to login if not authenticated
  if (!user) redirect("/login");

  // Get notification count for the header badge
  const hospitalId = await getDefaultHospitalId();
  const notifCount = hospitalId ? await getUnreadNotificationCount(hospitalId) : 0;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar navigation */}
      <AppSidebar />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader
          userEmail={user.email}
          notificationCount={notifCount}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      <Toaster position="top-right" />
    </div>
  );
}
