/* ============================================================
   Settings Panel — hospital, profile, and system config
   ============================================================ */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, Building, User, Database } from "lucide-react";
import type { Hospital } from "@/lib/types";
import { seedDemoData } from "@/app/actions/surgery";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Props {
  userEmail: string;
  hospitals: Hospital[];
}

export function SettingsPanel({ userEmail, hospitals }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSeed = () => {
    startTransition(async () => {
      const res = await seedDemoData();
      if (res.error) toast.error(res.error);
      else toast.success("Demo data loaded");
      router.refresh();
    });
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Profile */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-primary" /> Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input value={userEmail} disabled className="bg-muted" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Biometric Login</p>
              <p className="text-xs text-muted-foreground">WebAuthn fingerprint/face</p>
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-700">Active</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-primary" /> Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Two-Factor Auth</p>
              <p className="text-xs text-muted-foreground">WebAuthn + password</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Offline Mode</p>
              <p className="text-xs text-muted-foreground">IndexedDB encrypted caching</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Real-time Notifications</p>
              <p className="text-xs text-muted-foreground">WebSocket live updates</p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Hospital Info */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building className="h-4 w-4 text-primary" /> Hospital
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {hospitals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hospitals configured</p>
          ) : (
            hospitals.map(h => (
              <div key={h.id} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{h.name}</p>
                <p className="text-xs text-muted-foreground">{h.address}, {h.city}</p>
                <p className="text-xs text-muted-foreground">{h.phone}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4 text-primary" /> Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full" onClick={handleSeed} disabled={isPending}>
            {isPending ? "Loading..." : "Load Demo Data"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Creates sample hospital, ORs, staff, equipment, and surgeries for testing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
