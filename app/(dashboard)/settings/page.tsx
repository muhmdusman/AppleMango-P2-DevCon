/* Settings Page — hospital, profile, and system configuration */
import { createClient } from "@/lib/supabase/server";
import { getHospitals } from "@/lib/data";
import { SettingsPanel } from "@/components/settings/settings-panel";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const hospitals = await getHospitals();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account, hospital, and system preferences</p>
      </div>
      <SettingsPanel userEmail={user?.email ?? ""} hospitals={hospitals} />
    </div>
  );
}
