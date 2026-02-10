/* ============================================================
   Surgery List — filterable table with create, edit, delete
   Client component for interactivity (search, filter, pagination)
   Role-based access controls for actions
   ============================================================ */
"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, ChevronLeft, ChevronRight, Check, X, Pencil, Trash2, Eye } from "lucide-react";
import type { Surgery, Staff } from "@/lib/types";
import { createSurgery, approveSurgery, updateSurgery, deleteSurgery } from "@/app/actions/surgery";
import { toast } from "sonner";

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
  rescheduled: "bg-orange-100 text-orange-700",
};

interface Props {
  surgeries: Surgery[];
  totalCount: number;
  currentPage: number;
  hospitalId: string;
  surgeons: Staff[];
  filters: { status?: string; priority?: string; search?: string };
  userRole: string;
}

export function SurgeryList({ surgeries, totalCount, currentPage, hospitalId, surgeons, filters, userRole }: Props) {
  const router = useRouter();
  const searchParamsHook = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedSurgery, setSelectedSurgery] = useState<Surgery | null>(null);
  const [searchInput, setSearchInput] = useState(filters.search ?? "");

  const totalPages = Math.ceil(totalCount / 20);

  // Role permission helpers
  const canCreate = ["admin", "manager", "surgeon"].includes(userRole);
  const canApprove = ["admin", "manager"].includes(userRole);
  const canEdit = ["admin", "manager", "surgeon"].includes(userRole);
  const canDelete = ["admin", "manager"].includes(userRole);

  // Navigation helper for filters and pagination
  const updateUrl = (params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams(searchParamsHook.toString());
    Object.entries(params).forEach(([k, v]) => {
      if (v) sp.set(k, v); else sp.delete(k);
    });
    router.push(`/surgeries?${sp.toString()}`);
  };

  // Handle search
  const handleSearch = () => updateUrl({ search: searchInput || undefined, page: undefined });

  // Handle create surgery form submission
  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    form.set("hospital_id", hospitalId);

    startTransition(async () => {
      const result = await createSurgery(form);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Surgery created — AI predicted duration: ${result.predictedDuration} min`);
        setDialogOpen(false);
        router.refresh();
      }
    });
  };

  // Handle edit surgery
  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSurgery) return;
    const form = new FormData(e.currentTarget);
    form.set("hospital_id", hospitalId);

    startTransition(async () => {
      const result = await updateSurgery(selectedSurgery.id, form);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Surgery updated successfully");
        setEditDialogOpen(false);
        setSelectedSurgery(null);
        router.refresh();
      }
    });
  };

  // Handle delete surgery
  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteSurgery(id);
      if (result.error) toast.error(result.error);
      else toast.success("Surgery deleted");
      router.refresh();
    });
  };

  // Handle approve/reject
  const handleApproval = (id: string, approved: boolean) => {
    startTransition(async () => {
      const result = await approveSurgery(id, approved);
      if (result.error) toast.error(result.error);
      else toast.success(approved ? "Surgery approved" : "Surgery rejected");
      router.refresh();
    });
  };

  // Surgery form fields (shared by create and edit)
  const SurgeryFormFields = ({ surgery }: { surgery?: Surgery | null }) => (
    <>
      {/* Patient Info */}
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Patient Name *</Label><Input name="patient_name" required defaultValue={surgery?.patient_name} /></div>
        <div><Label>Age</Label><Input name="patient_age" type="number" defaultValue={surgery?.patient_age ?? ""} /></div>
        <div>
          <Label>Gender</Label>
          <Select name="patient_gender" defaultValue={surgery?.patient_gender ?? ""}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label>BMI</Label><Input name="patient_bmi" type="number" step="0.1" defaultValue={surgery?.patient_bmi ?? ""} /></div>
      </div>

      <div><Label>ASA Score (1-6)</Label><Input name="patient_asa_score" type="number" min={1} max={6} defaultValue={surgery?.patient_asa_score ?? ""} /></div>

      {/* Procedure Info */}
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Procedure Name *</Label><Input name="procedure_name" required defaultValue={surgery?.procedure_name} /></div>
        <div><Label>Procedure Type</Label><Input name="procedure_type" placeholder="e.g., cardiac" defaultValue={surgery?.procedure_type ?? ""} /></div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Complexity (1-5) *</Label>
          <Select name="complexity" defaultValue={String(surgery?.complexity ?? 3)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Priority *</Label>
          <Select name="priority" defaultValue={surgery?.priority ?? "elective"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="emergency">Emergency</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="elective">Elective</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Est. Duration (min)</Label><Input name="estimated_duration" type="number" defaultValue={surgery?.estimated_duration ?? 60} /></div>
      </div>

      <div>
        <Label>Surgeon</Label>
        <Select name="surgeon_id" defaultValue={surgery?.surgeon_id ?? ""}>
          <SelectTrigger><SelectValue placeholder="Assign surgeon" /></SelectTrigger>
          <SelectContent>
            {surgeons.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name} — {s.specialization}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Specialization Required</Label>
        <Select name="specialization_required" defaultValue={surgery?.specialization_required ?? ""}>
          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="cardiac">Cardiac</SelectItem>
            <SelectItem value="neuro">Neuro</SelectItem>
            <SelectItem value="orthopedic">Orthopedic</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Anesthesia Type</Label>
        <Select name="anesthesia_type" defaultValue={surgery?.anesthesia_type ?? "general"}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="regional">Regional</SelectItem>
            <SelectItem value="local">Local</SelectItem>
            <SelectItem value="sedation">Sedation</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div><Label>Pre-Op Requirements</Label><Textarea name="pre_op_requirements" rows={2} defaultValue={surgery?.pre_op_requirements ?? ""} /></div>
      <div><Label>Post-Op Requirements</Label><Textarea name="post_op_requirements" rows={2} defaultValue={surgery?.post_op_requirements ?? ""} /></div>
    </>
  );

  return (
    <div className="space-y-4">
      {/* Toolbar: Search + Filters + Create */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search patients or procedures..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-9"
          />
        </div>

        <Select value={filters.priority ?? "all"} onValueChange={(v) => updateUrl({ priority: v === "all" ? undefined : v, page: undefined })}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="emergency">Emergency</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="elective">Elective</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.status ?? "all"} onValueChange={(v) => updateUrl({ status: v === "all" ? undefined : v, page: undefined })}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        {/* Create Surgery Dialog — role gated */}
        {canCreate && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> New Surgery</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>New Surgery Request</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <SurgeryFormFields />
                <Button type="submit" disabled={isPending} className="w-full">
                  {isPending ? "Creating..." : "Create Surgery Request"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Edit Surgery Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) setSelectedSurgery(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Surgery</DialogTitle>
          </DialogHeader>
          {selectedSurgery && (
            <form onSubmit={handleEdit} className="space-y-4">
              <SurgeryFormFields surgery={selectedSurgery} />
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* View Surgery Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={(open) => { setViewDialogOpen(open); if (!open) setSelectedSurgery(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Surgery Details</DialogTitle>
          </DialogHeader>
          {selectedSurgery && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="font-medium text-muted-foreground">Patient:</span> <span className="font-semibold">{selectedSurgery.patient_name}</span></div>
                <div><span className="font-medium text-muted-foreground">Age:</span> {selectedSurgery.patient_age ?? "—"}</div>
                <div><span className="font-medium text-muted-foreground">Gender:</span> {selectedSurgery.patient_gender ?? "—"}</div>
                <div><span className="font-medium text-muted-foreground">BMI:</span> {selectedSurgery.patient_bmi ?? "—"}</div>
              </div>
              <hr />
              <div className="grid grid-cols-2 gap-3">
                <div><span className="font-medium text-muted-foreground">Procedure:</span> <span className="font-semibold">{selectedSurgery.procedure_name}</span></div>
                <div><span className="font-medium text-muted-foreground">Type:</span> {selectedSurgery.procedure_type ?? "—"}</div>
                <div><span className="font-medium text-muted-foreground">Priority:</span> <Badge variant="outline" className={priorityColors[selectedSurgery.priority]}>{selectedSurgery.priority}</Badge></div>
                <div><span className="font-medium text-muted-foreground">Status:</span> <Badge variant="secondary" className={statusColors[selectedSurgery.status]}>{selectedSurgery.status.replace("_", " ")}</Badge></div>
                <div><span className="font-medium text-muted-foreground">Complexity:</span> {selectedSurgery.complexity}/5</div>
                <div><span className="font-medium text-muted-foreground">Anesthesia:</span> {selectedSurgery.anesthesia_type ?? "—"}</div>
              </div>
              <hr />
              <div className="grid grid-cols-2 gap-3">
                <div><span className="font-medium text-muted-foreground">Est. Duration:</span> {selectedSurgery.estimated_duration} min</div>
                <div><span className="font-medium text-muted-foreground">AI Predicted:</span> {selectedSurgery.predicted_duration ? `${selectedSurgery.predicted_duration} min` : "—"}</div>
                <div><span className="font-medium text-muted-foreground">Surgeon:</span> {selectedSurgery.surgeon?.full_name ?? "Unassigned"}</div>
                <div><span className="font-medium text-muted-foreground">Specialization:</span> {selectedSurgery.specialization_required ?? "—"}</div>
              </div>
              {selectedSurgery.pre_op_requirements && (
                <div><span className="font-medium text-muted-foreground">Pre-Op:</span><p className="mt-1 text-xs bg-muted p-2 rounded">{selectedSurgery.pre_op_requirements}</p></div>
              )}
              {selectedSurgery.post_op_requirements && (
                <div><span className="font-medium text-muted-foreground">Post-Op:</span><p className="mt-1 text-xs bg-muted p-2 rounded">{selectedSurgery.post_op_requirements}</p></div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Surgery table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                  <th className="p-3 font-medium">Patient</th>
                  <th className="p-3 font-medium">Procedure</th>
                  <th className="p-3 font-medium">Priority</th>
                  <th className="p-3 font-medium">Complexity</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Duration</th>
                  <th className="p-3 font-medium">Surgeon</th>
                  <th className="p-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {surgeries.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No surgeries found</td></tr>
                ) : (
                  surgeries.map((s) => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-medium">{s.patient_name}</td>
                      <td className="p-3 text-muted-foreground">{s.procedure_name}</td>
                      <td className="p-3">
                        <Badge variant="outline" className={priorityColors[s.priority]}>{s.priority}</Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-0.5">{Array.from({ length: 5 }, (_, i) => (
                          <div key={i} className={`h-2 w-2 rounded-full ${i < s.complexity ? "bg-primary" : "bg-muted"}`} />
                        ))}</div>
                      </td>
                      <td className="p-3">
                        <Badge variant="secondary" className={statusColors[s.status]}>{s.status.replace("_", " ")}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {s.predicted_duration ? (
                          <span>{s.predicted_duration} min <span className="text-xs text-primary">(AI)</span></span>
                        ) : (
                          <span>{s.estimated_duration} min</span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">{s.surgeon?.full_name ?? "—"}</td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1">
                          {/* View details */}
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setSelectedSurgery(s); setViewDialogOpen(true); }}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>

                          {/* Approve/Reject — admin/manager only */}
                          {canApprove && s.approval_status === "pending" && (
                            <>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600" onClick={() => handleApproval(s.id, true)}>
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => handleApproval(s.id, false)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}

                          {/* Edit — admin/manager/surgeon */}
                          {canEdit && !["completed", "cancelled"].includes(s.status) && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setSelectedSurgery(s); setEditDialogOpen(true); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}

                          {/* Delete — admin/manager only */}
                          {canDelete && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Surgery</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete &quot;{s.procedure_name}&quot; for patient {s.patient_name}? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(s.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * 20 + 1}–{Math.min(currentPage * 20, totalCount)} of {totalCount}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => updateUrl({ page: String(currentPage - 1) })}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => updateUrl({ page: String(currentPage + 1) })}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
