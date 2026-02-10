/* Seed demo data banner — shown when no hospital exists yet */
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database } from "lucide-react";
import { seedDemoData } from "@/app/actions/surgery";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function SeedDataBanner() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSeed = () => {
    startTransition(async () => {
      const result = await seedDemoData();
      if (result.success) {
        router.refresh();
      }
    });
  };

  return (
    <div className="flex h-[60vh] items-center justify-center">
      <Card className="max-w-md border-0 shadow-sm">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="rounded-full bg-primary/10 p-4">
            <Database className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold">Welcome to MedScheduler</h2>
          <p className="text-sm text-muted-foreground">
            No hospital data found. Load demo data to explore the system with
            sample hospitals, operating rooms, staff, equipment, and surgeries.
          </p>
          <Button onClick={handleSeed} disabled={isPending} className="mt-2">
            {isPending ? "Loading..." : "Load Demo Data"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
