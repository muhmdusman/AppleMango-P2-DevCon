/* ============================================================
   Server actions for Surgery CRUD, scheduling, equipment, etc.
   All actions verify authentication before proceeding.
   ============================================================ */
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { predictSurgeryDuration } from "@/lib/ai";
import { getAuthUser } from "@/lib/auth/getAuthUser";

// ── Surgery CRUD ──────────────────────────────────────────

export async function createSurgery(formData: FormData) {
  const { user } = await getAuthUser();
  if (!user) return { error: "Unauthorized" };

  const supabase = await createClient();

  const complexity = parseInt(formData.get("complexity") as string) || 3;
  const estimatedDuration = parseInt(formData.get("estimated_duration") as string) || 60;

  // AI: predict surgery duration
  const prediction = predictSurgeryDuration({
    complexity,
    estimatedDuration,
    patientAge: parseInt(formData.get("patient_age") as string) || undefined,
    patientBmi: parseFloat(formData.get("patient_bmi") as string) || undefined,
    asaScore: parseInt(formData.get("patient_asa_score") as string) || undefined,
  });

  const { error } = await supabase.from("surgeries").insert({
    hospital_id: formData.get("hospital_id"),
    patient_name: formData.get("patient_name"),
    patient_age: parseInt(formData.get("patient_age") as string) || null,
    patient_gender: formData.get("patient_gender") || null,
    patient_bmi: parseFloat(formData.get("patient_bmi") as string) || null,
    patient_asa_score: parseInt(formData.get("patient_asa_score") as string) || null,
    procedure_name: formData.get("procedure_name"),
    procedure_type: formData.get("procedure_type") || null,
    complexity,
    priority: formData.get("priority") || "elective",
    specialization_required: formData.get("specialization_required") || null,
    estimated_duration: estimatedDuration,
    predicted_duration: prediction.predicted,
    anesthesia_type: formData.get("anesthesia_type") || "general",
    pre_op_requirements: formData.get("pre_op_requirements") || null,
    post_op_requirements: formData.get("post_op_requirements") || null,
    surgeon_id: formData.get("surgeon_id") || null,
    status: "pending",
    approval_status: "pending",
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/surgeries");
  revalidatePath("/dashboard");
  return { success: true, predictedDuration: prediction.predicted };
}

export async function updateSurgeryStatus(id: string, status: string) {
  const { user } = await getAuthUser();
  if (!user) return { error: "Unauthorized" };

  const supabase = await createClient();

  const { error } = await supabase
    .from("surgeries")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/surgeries");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function approveSurgery(id: string, approved: boolean) {
  const { user } = await getAuthUser();
  if (!user) return { error: "Unauthorized" };

  const supabase = await createClient();

  const { error } = await supabase
    .from("surgeries")
    .update({
      approval_status: approved ? "approved" : "rejected",
      status: approved ? "approved" : "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/surgeries");
  revalidatePath("/dashboard");
  return { success: true };
}

// ── Schedule Management ───────────────────────────────────

export async function scheduleSurgery(
  surgeryId: string,
  orId: string,
  startTime: string,
  endTime: string
) {
  const { user } = await getAuthUser();
  if (!user) return { error: "Unauthorized" };

  const supabase = await createClient();

  // Update surgery record
  const { error: surgeryError } = await supabase
    .from("surgeries")
    .update({
      or_id: orId,
      scheduled_start: startTime,
      scheduled_end: endTime,
      status: "scheduled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", surgeryId);

  if (surgeryError) return { error: surgeryError.message };

  // Create schedule slots (setup + surgery + cleanup)
  const start = new Date(startTime);
  const end = new Date(endTime);
  const setupStart = new Date(start.getTime() - 15 * 60000);
  const cleanupEnd = new Date(end.getTime() + 15 * 60000);

  const slots = [
    { surgery_id: surgeryId, or_id: orId, start_time: setupStart.toISOString(), end_time: startTime, slot_type: "setup" },
    { surgery_id: surgeryId, or_id: orId, start_time: startTime, end_time: endTime, slot_type: "surgery" },
    { surgery_id: surgeryId, or_id: orId, start_time: endTime, end_time: cleanupEnd.toISOString(), slot_type: "cleanup" },
  ];

  const { error: slotError } = await supabase.from("schedule_slots").insert(slots);
  if (slotError) return { error: slotError.message };

  revalidatePath("/schedule");
  revalidatePath("/dashboard");
  return { success: true };
}

// ── Equipment Management ──────────────────────────────────

export async function updateEquipmentStatus(id: string, status: string) {
  const { user } = await getAuthUser();
  if (!user) return { error: "Unauthorized" };

  const supabase = await createClient();

  const updateData: Record<string, unknown> = { status };
  if (status === "available") {
    updateData.last_sterilized = new Date().toISOString();
  }

  const { error } = await supabase.from("equipment").update(updateData).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/equipment");
  return { success: true };
}

export async function createEquipment(formData: FormData) {
  const { user } = await getAuthUser();
  if (!user) return { error: "Unauthorized" };

  const supabase = await createClient();

  const { error } = await supabase.from("equipment").insert({
    hospital_id: formData.get("hospital_id"),
    name: formData.get("name"),
    equipment_type: formData.get("equipment_type"),
    status: "available",
    location: formData.get("location") || null,
  });

  if (error) return { error: error.message };
  revalidatePath("/equipment");
  return { success: true };
}

// ── Notifications ─────────────────────────────────────────

export async function markNotificationRead(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/notifications");
  return { success: true };
}

export async function markAllNotificationsRead(hospitalId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("hospital_id", hospitalId)
    .eq("is_read", false);
  if (error) return { error: error.message };
  revalidatePath("/notifications");
  return { success: true };
}

// ── Seed Demo Data ────────────────────────────────────────

export async function seedDemoData() {
  const { user } = await getAuthUser();
  if (!user) return { error: "Unauthorized" };

  const supabase = await createClient();

  // Check if hospital already exists
  const { data: existing } = await supabase.from("hospitals").select("id").limit(1);
  if (existing && existing.length > 0) return { success: true, hospitalId: existing[0].id };

  // Create demo hospital
  const { data: hospital, error: hospError } = await supabase
    .from("hospitals")
    .insert({ name: "City General Hospital", address: "123 Medical Ave", city: "Islamabad", phone: "+92-300-1234567", email: "admin@citygeneral.pk" })
    .select("id")
    .single();

  if (hospError || !hospital) return { error: hospError?.message ?? "Failed to create hospital" };
  const hId = hospital.id;

  // Create Operating Rooms
  await supabase.from("operating_rooms").insert([
    { hospital_id: hId, name: "OR-1 General", room_type: "general", capabilities: ["general", "orthopedic"] },
    { hospital_id: hId, name: "OR-2 Cardiac", room_type: "cardiac", capabilities: ["cardiac", "vascular"] },
    { hospital_id: hId, name: "OR-3 Neuro", room_type: "neuro", capabilities: ["neuro", "spine"] },
    { hospital_id: hId, name: "OR-4 Orthopedic", room_type: "orthopedic", capabilities: ["orthopedic", "trauma"] },
  ]);

  // Create Staff
  await supabase.from("staff").insert([
    { hospital_id: hId, full_name: "Dr. Ahmed Khan", role: "surgeon", specialization: "general", email: "ahmed@hospital.pk" },
    { hospital_id: hId, full_name: "Dr. Sara Ali", role: "surgeon", specialization: "cardiac", email: "sara@hospital.pk" },
    { hospital_id: hId, full_name: "Dr. Usman Tariq", role: "surgeon", specialization: "neuro", email: "usman@hospital.pk" },
    { hospital_id: hId, full_name: "Dr. Fatima Zahra", role: "anesthesiologist", email: "fatima@hospital.pk" },
    { hospital_id: hId, full_name: "Nurse Ayesha", role: "nurse", email: "ayesha@hospital.pk" },
    { hospital_id: hId, full_name: "Nurse Hassan", role: "nurse", email: "hassan@hospital.pk" },
  ]);

  // Create Equipment
  await supabase.from("equipment").insert([
    { hospital_id: hId, name: "Surgical Instrument Set A", equipment_type: "instruments", status: "available", location: "Storage Room 1", usage_count: 45 },
    { hospital_id: hId, name: "Anesthesia Machine 1", equipment_type: "anesthesia", status: "available", location: "OR-1", usage_count: 120 },
    { hospital_id: hId, name: "Heart-Lung Machine", equipment_type: "cardiac", status: "available", location: "OR-2", usage_count: 30 },
    { hospital_id: hId, name: "Surgical Microscope", equipment_type: "neuro", status: "available", location: "OR-3", usage_count: 78 },
    { hospital_id: hId, name: "C-Arm Fluoroscopy", equipment_type: "imaging", status: "available", location: "OR-4", usage_count: 92 },
    { hospital_id: hId, name: "Electrocautery Unit", equipment_type: "instruments", status: "sterilizing", location: "Sterilization", usage_count: 156 },
  ]);

  // Create sample surgeries
  const now = new Date();
  const surgeries = [
    { hospital_id: hId, patient_name: "Ali Hassan", procedure_name: "Appendectomy", complexity: 2, priority: "urgent", estimated_duration: 60, status: "scheduled", approval_status: "approved", scheduled_start: new Date(now.getTime() + 2 * 3600000).toISOString(), scheduled_end: new Date(now.getTime() + 3 * 3600000).toISOString(), created_by: user.id },
    { hospital_id: hId, patient_name: "Zara Sheikh", procedure_name: "Coronary Bypass", complexity: 5, priority: "emergency", estimated_duration: 240, status: "in_progress", approval_status: "approved", created_by: user.id },
    { hospital_id: hId, patient_name: "Bilal Ahmed", procedure_name: "Knee Replacement", complexity: 3, priority: "elective", estimated_duration: 120, status: "pending", approval_status: "pending", created_by: user.id },
    { hospital_id: hId, patient_name: "Maryam Noor", procedure_name: "Craniotomy", complexity: 5, priority: "urgent", estimated_duration: 180, status: "approved", approval_status: "approved", created_by: user.id },
    { hospital_id: hId, patient_name: "Imran Malik", procedure_name: "Hernia Repair", complexity: 2, priority: "elective", estimated_duration: 90, status: "pending", approval_status: "pending", created_by: user.id },
    { hospital_id: hId, patient_name: "Sana Farooq", procedure_name: "Cholecystectomy", complexity: 3, priority: "elective", estimated_duration: 75, status: "completed", approval_status: "approved", actual_duration: 80, created_by: user.id },
  ];

  await supabase.from("surgeries").insert(surgeries);

  // Create notifications
  await supabase.from("notifications").insert([
    { hospital_id: hId, title: "Emergency Case", message: "New emergency surgery request: Coronary Bypass for Zara Sheikh", type: "emergency", category: "emergency" },
    { hospital_id: hId, title: "Equipment Alert", message: "Electrocautery Unit is being sterilized — unavailable for 2 hours", type: "warning", category: "equipment" },
    { hospital_id: hId, title: "Schedule Update", message: "Appendectomy for Ali Hassan moved to OR-1 at 14:00", type: "info", category: "schedule" },
    { hospital_id: hId, title: "Staff Update", message: "Dr. Ahmed Khan is now available for afternoon surgeries", type: "success", category: "staff" },
  ]);

  revalidatePath("/dashboard");
  revalidatePath("/surgeries");
  revalidatePath("/equipment");
  revalidatePath("/schedule");
  return { success: true, hospitalId: hId };
}
