/* ============================================================
   Equipment List — inventory with status, sterilization, AI risk
   ============================================================ */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Plus, AlertTriangle, CheckCircle, Wrench, Droplets } from "lucide-react";
import type { Equipment } from "@/lib/types";
import { updateEquipmentStatus, createEquipment } from "@/app/actions/surgery";
import { predictEquipmentFailure } from "@/lib/ai";
import { toast } from "sonner";

const statusIcons: Record<string, React.ReactNode> = {
  available: <CheckCircle className="h-4 w-4 text-green-500" />,
  in_use: <Wrench className="h-4 w-4 text-blue-500" />,
  sterilizing: <Droplets className="h-4 w-4 text-cyan-500" />,
  maintenance: <Wrench className="h-4 w-4 text-yellow-500" />,
  retired: <AlertTriangle className="h-4 w-4 text-red-500" />,
};

const statusBadgeColors: Record<string, string> = {
  available: "bg-green-100 text-green-700",
  in_use: "bg-blue-100 text-blue-700",
  sterilizing: "bg-cyan-100 text-cyan-700",
  maintenance: "bg-yellow-100 text-yellow-700",
  retired: "bg-red-100 text-red-700",
};

interface Props {
  equipment: Equipment[];
  hospitalId: string;
}

export function EquipmentList({ equipment, hospitalId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? equipment : equipment.filter(e => e.status === filter);

  const handleStatusChange = (id: string, status: string) => {
    startTransition(async () => {
      const res = await updateEquipmentStatus(id, status);
      if (res.error) toast.error(res.error);
      else toast.success("Equipment status updated");
      router.refresh();
    });
  };

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    form.set("hospital_id", hospitalId);
    startTransition(async () => {
      const res = await createEquipment(form);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Equipment added");
        setDialogOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Filter" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Equipment</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="in_use">In Use</SelectItem>
            <SelectItem value="sterilizing">Sterilizing</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
          </SelectContent>
        </Select>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Equipment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Equipment</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div><Label>Name *</Label><Input name="name" required /></div>
              <div>
                <Label>Type *</Label>
                <Select name="equipment_type">
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instruments">Surgical Instruments</SelectItem>
                    <SelectItem value="anesthesia">Anesthesia</SelectItem>
                    <SelectItem value="cardiac">Cardiac</SelectItem>
                    <SelectItem value="neuro">Neuro</SelectItem>
                    <SelectItem value="imaging">Imaging</SelectItem>
                    <SelectItem value="monitoring">Monitoring</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Location</Label><Input name="location" /></div>
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? "Adding..." : "Add Equipment"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Equipment grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(eq => {
          const prediction = predictEquipmentFailure({
            usageCount: eq.usage_count,
            maxUsage: eq.max_usage_before_maintenance,
            lastMaintenance: eq.last_sterilized ?? undefined,
          });
          const usagePct = Math.round((eq.usage_count / eq.max_usage_before_maintenance) * 100);

          return (
            <Card key={eq.id} className="border-0 shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {statusIcons[eq.status]}
                    <div>
                      <p className="font-medium text-sm">{eq.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{eq.equipment_type}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className={statusBadgeColors[eq.status]}>
                    {eq.status.replace("_", " ")}
                  </Badge>
                </div>

                {/* Usage progress */}
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Usage: {eq.usage_count}/{eq.max_usage_before_maintenance}</span>
                    <span>{usagePct}%</span>
                  </div>
                  <Progress value={usagePct} className="h-1.5" />
                </div>

                {/* AI failure prediction */}
                <div className={`rounded-md px-2.5 py-1.5 text-xs ${
                  prediction.risk === "critical" ? "bg-red-50 text-red-700" :
                  prediction.risk === "high" ? "bg-yellow-50 text-yellow-700" :
                  prediction.risk === "medium" ? "bg-orange-50 text-orange-700" :
                  "bg-green-50 text-green-700"
                }`}>
                  <div className="flex items-center gap-1 font-medium mb-0.5">
                    {prediction.risk !== "low" && <AlertTriangle className="h-3 w-3" />}
                    AI Risk: {prediction.risk} ({prediction.score}%)
                  </div>
                  <p>{prediction.action}</p>
                </div>

                {/* Location */}
                {eq.location && (
                  <p className="text-xs text-muted-foreground">📍 {eq.location}</p>
                )}

                {/* Quick actions */}
                <div className="flex gap-2">
                  {eq.status !== "available" && (
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleStatusChange(eq.id, "available")}>
                      Mark Available
                    </Button>
                  )}
                  {eq.status === "available" && (
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleStatusChange(eq.id, "sterilizing")}>
                      Sterilize
                    </Button>
                  )}
                  {eq.status !== "maintenance" && (
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleStatusChange(eq.id, "maintenance")}>
                      Maintenance
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-12">No equipment to display</p>
      )}
    </div>
  );
}
