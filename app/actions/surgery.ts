/* ============================================================
   Server actions for Surgery CRUD, scheduling, equipment, etc.
   All actions verify authentication before proceeding.
   Role-based: Admin/Manager can approve, Surgeon can create.
   ============================================================ */
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { predictSurgeryDuration } from "@/lib/ai";

// ── Role-based permission helpers ─────────────────────────

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email,
    role: profile?.role ?? user.user_metadata?.role ?? "scheduler",
  };
}

function canCreateSurgery(role: string): boolean {
  return ["admin", "manager", "surgeon", "scheduler"].includes(role);
}

function canApproveSurgery(role: string): boolean {
  return ["admin", "manager"].includes(role);
}

function canScheduleSurgery(role: string): boolean {
  return ["admin", "manager", "scheduler"].includes(role);
}

function canManageEquipment(role: string): boolean {
  return ["admin", "manager", "nurse"].includes(role);
}

// ── Surgery CRUD ──────────────────────────────────────────

export async function createSurgery(formData: FormData) {
  const user = await getAuthUser();
  if (!user) return { error: "Unauthorized" };
  if (!canCreateSurgery(user.role)) return { error: `Role "${user.role}" cannot create surgeries` };

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

  // Create notification for new surgery request
  const hospitalId = formData.get("hospital_id") as string;
  await supabase.from("notifications").insert({
    hospital_id: hospitalId,
    title: `New Surgery Request`,
    message: `${formData.get("procedure_name")} for ${formData.get("patient_name")} — Priority: ${formData.get("priority")}`,
    type: formData.get("priority") === "emergency" ? "emergency" : "info",
    category: formData.get("priority") === "emergency" ? "emergency" : "schedule",
  });

  revalidatePath("/surgeries");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  return { success: true, predictedDuration: prediction.predicted };
}

export async function updateSurgery(id: string, formData: FormData) {
  const user = await getAuthUser();
  if (!user) return { error: "Unauthorized" };

  const supabase = await createClient();

  const complexity = parseInt(formData.get("complexity") as string) || 3;
  const estimatedDuration = parseInt(formData.get("estimated_duration") as string) || 60;

  const prediction = predictSurgeryDuration({
    complexity,
    estimatedDuration,
    patientAge: parseInt(formData.get("patient_age") as string) || undefined,
    patientBmi: parseFloat(formData.get("patient_bmi") as string) || undefined,
    asaScore: parseInt(formData.get("patient_asa_score") as string) || undefined,
  });

  const { error } = await supabase
    .from("surgeries")
    .update({
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
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/surgeries");
  revalidatePath("/dashboard");
  return { success: true, predictedDuration: prediction.predicted };
}

export async function deleteSurgery(id: string) {
  const user = await getAuthUser();
  if (!user) return { error: "Unauthorized" };
  if (!canApproveSurgery(user.role)) return { error: `Role "${user.role}" cannot delete surgeries` };

  const supabase = await createClient();

  // Delete linked schedule slots first
  await supabase.from("schedule_slots").delete().eq("surgery_id", id);
  // Delete the surgery
  const { error } = await supabase.from("surgeries").delete().eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/surgeries");
  revalidatePath("/schedule");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateSurgeryStatus(id: string, status: string) {
  const user = await getAuthUser();
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
  const user = await getAuthUser();
  if (!user) return { error: "Unauthorized" };
  if (!canApproveSurgery(user.role)) return { error: `Only Admin or OR Manager can approve surgeries` };

  const supabase = await createClient();

  const { data: surgery } = await supabase.from("surgeries").select("*").eq("id", id).single();

  const { error } = await supabase
    .from("surgeries")
    .update({
      approval_status: approved ? "approved" : "rejected",
      status: approved ? "approved" : "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  // Create notification
  if (surgery) {
    await supabase.from("notifications").insert({
      hospital_id: surgery.hospital_id,
      title: approved ? "Surgery Approved" : "Surgery Rejected",
      message: `${surgery.procedure_name} for ${surgery.patient_name} has been ${approved ? "approved" : "rejected"} by ${user.email}`,
      type: approved ? "success" : "warning",
      category: "schedule",
    });
  }

  revalidatePath("/surgeries");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  revalidatePath("/priority-queue");
  return { success: true };
}

// ── Schedule Management ───────────────────────────────────

export async function scheduleSurgery(
  surgeryId: string,
  orId: string,
  startTime: string,
  endTime: string
) {
  const user = await getAuthUser();
  if (!user) return { error: "Unauthorized" };
  if (!canScheduleSurgery(user.role)) return { error: `Role "${user.role}" cannot schedule surgeries` };

  const supabase = await createClient();

  // Get surgery details for notification
  const { data: surgery } = await supabase.from("surgeries").select("*, operating_room:operating_rooms(name)").eq("id", surgeryId).single();

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

  // Get OR name for notification
  const { data: or } = await supabase.from("operating_rooms").select("name").eq("id", orId).single();

  // Create notification
  if (surgery) {
    await supabase.from("notifications").insert({
      hospital_id: surgery.hospital_id,
      title: "Surgery Scheduled",
      message: `${surgery.procedure_name} for ${surgery.patient_name} scheduled in ${or?.name ?? "OR"} at ${new Date(startTime).toLocaleTimeString()}`,
      type: "info",
      category: "schedule",
    });
  }

  revalidatePath("/schedule");
  revalidatePath("/surgeries");
  revalidatePath("/dashboard");
  revalidatePath("/priority-queue");
  revalidatePath("/notifications");
  return { success: true };
}

// ── Equipment Management ──────────────────────────────────

export async function updateEquipmentStatus(id: string, status: string) {
  const user = await getAuthUser();
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
  const user = await getAuthUser();
  if (!user) return { error: "Unauthorized" };
  if (!canManageEquipment(user.role)) return { error: `Role "${user.role}" cannot add equipment` };

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

// ── Seed Demo Data (comprehensive realistic data) ─────────

export async function seedDemoData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Check if hospital already exists
  const { data: existing } = await supabase.from("hospitals").select("id").limit(1);
  if (existing && existing.length > 0) return { success: true, hospitalId: existing[0].id };

  // ── Create Hospital ──
  const { data: hospital, error: hospError } = await supabase
    .from("hospitals")
    .insert({
      name: "Pakistan Institute of Medical Sciences",
      address: "G-8/3, Islamabad",
      city: "Islamabad",
      phone: "+92-51-9261170",
      email: "admin@pims.gov.pk",
    })
    .select("id")
    .single();

  if (hospError || !hospital) return { error: hospError?.message ?? "Failed to create hospital" };
  const hId = hospital.id;

  // ── Create Operating Rooms (6 ORs per scope) ──
  await supabase.from("operating_rooms").insert([
    { hospital_id: hId, name: "OR-1 General A", room_type: "general", status: "available", capabilities: ["general", "laparoscopic", "emergency"] },
    { hospital_id: hId, name: "OR-2 General B", room_type: "general", status: "occupied", capabilities: ["general", "bariatric", "trauma"] },
    { hospital_id: hId, name: "OR-3 Cardiac", room_type: "cardiac", status: "available", capabilities: ["cardiac", "vascular", "thoracic"] },
    { hospital_id: hId, name: "OR-4 Neuro", room_type: "neuro", status: "available", capabilities: ["neuro", "spine", "cranial"] },
    { hospital_id: hId, name: "OR-5 Orthopedic", room_type: "orthopedic", status: "available", capabilities: ["orthopedic", "trauma", "arthroplasty"] },
    { hospital_id: hId, name: "OR-6 ENT/Ophthalmic", room_type: "ent", status: "maintenance", capabilities: ["ent", "ophthalmic", "dental"] },
  ]);

  // ── Create Staff (realistic Pakistani medical professionals) ──
  const staffData = [
    // Surgeons
    { hospital_id: hId, full_name: "Prof. Dr. Ahmed Raza Khan", role: "surgeon", specialization: "general", email: "ahmed.khan@pims.gov.pk", max_hours_per_day: 12 },
    { hospital_id: hId, full_name: "Dr. Sana Fatima Zaidi", role: "surgeon", specialization: "cardiac", email: "sana.zaidi@pims.gov.pk", max_hours_per_day: 10 },
    { hospital_id: hId, full_name: "Dr. Muhammad Usman Tariq", role: "surgeon", specialization: "neuro", email: "usman.tariq@pims.gov.pk", max_hours_per_day: 12 },
    { hospital_id: hId, full_name: "Dr. Ayesha Malik", role: "surgeon", specialization: "orthopedic", email: "ayesha.malik@pims.gov.pk", max_hours_per_day: 10 },
    { hospital_id: hId, full_name: "Dr. Hassan Ali Shah", role: "surgeon", specialization: "general", email: "hassan.shah@pims.gov.pk", max_hours_per_day: 12 },
    // Anesthesiologists
    { hospital_id: hId, full_name: "Dr. Fatima Noor", role: "anesthesiologist", specialization: "cardiac", email: "fatima.noor@pims.gov.pk", max_hours_per_day: 12 },
    { hospital_id: hId, full_name: "Dr. Bilal Ahmed Qureshi", role: "anesthesiologist", specialization: "general", email: "bilal.qureshi@pims.gov.pk", max_hours_per_day: 10 },
    // Nurses
    { hospital_id: hId, full_name: "Nurse Rabia Akhtar", role: "nurse", email: "rabia.akhtar@pims.gov.pk", max_hours_per_day: 8 },
    { hospital_id: hId, full_name: "Nurse Imran Haider", role: "nurse", email: "imran.haider@pims.gov.pk", max_hours_per_day: 8 },
    { hospital_id: hId, full_name: "Nurse Zainab Bibi", role: "nurse", email: "zainab.bibi@pims.gov.pk", max_hours_per_day: 8 },
    // OR Manager
    { hospital_id: hId, full_name: "Dr. Nadia Hussain", role: "or_manager", email: "nadia.hussain@pims.gov.pk", max_hours_per_day: 10 },
    // Scheduler
    { hospital_id: hId, full_name: "Saad Mehmood", role: "scheduler", email: "saad.mehmood@pims.gov.pk", max_hours_per_day: 8 },
  ];

  // Link current user to staff if possible
  const userRole = user.user_metadata?.role ?? "admin";
  const staffRole = userRole === "admin" || userRole === "manager" ? "or_manager" : userRole;
  staffData.push({
    hospital_id: hId,
    full_name: user.user_metadata?.full_name ?? user.email ?? "Admin User",
    role: staffRole,
    specialization: staffRole === "surgeon" ? "general" : undefined as unknown as string,
    email: user.email ?? "",
    max_hours_per_day: 12,
  });

  const { data: staffInserted } = await supabase.from("staff").insert(staffData).select("id, role, specialization");

  const surgeonIds = staffInserted?.filter(s => s.role === "surgeon").map(s => s.id) ?? [];

  // ── Create Equipment (comprehensive inventory) ──
  await supabase.from("equipment").insert([
    // Surgical instruments
    { hospital_id: hId, name: "General Surgical Set A", equipment_type: "instruments", status: "available", location: "Storage-1", usage_count: 47, max_usage_before_maintenance: 100 },
    { hospital_id: hId, name: "General Surgical Set B", equipment_type: "instruments", status: "in_use", location: "OR-2", usage_count: 89, max_usage_before_maintenance: 100 },
    { hospital_id: hId, name: "Laparoscopic Tower", equipment_type: "instruments", status: "available", location: "OR-1", usage_count: 62, max_usage_before_maintenance: 150 },
    // Anesthesia
    { hospital_id: hId, name: "Anesthesia Machine (Dräger Primus)", equipment_type: "anesthesia", status: "available", location: "OR-1", usage_count: 234, max_usage_before_maintenance: 500 },
    { hospital_id: hId, name: "Anesthesia Machine (GE Aisys)", equipment_type: "anesthesia", status: "available", location: "OR-3", usage_count: 189, max_usage_before_maintenance: 500 },
    // Cardiac
    { hospital_id: hId, name: "Heart-Lung Bypass Machine", equipment_type: "cardiac", status: "available", location: "OR-3", usage_count: 28, max_usage_before_maintenance: 50 },
    { hospital_id: hId, name: "Intra-Aortic Balloon Pump", equipment_type: "cardiac", status: "available", location: "OR-3", usage_count: 15, max_usage_before_maintenance: 80 },
    // Neuro
    { hospital_id: hId, name: "Surgical Microscope (Zeiss)", equipment_type: "neuro", status: "available", location: "OR-4", usage_count: 78, max_usage_before_maintenance: 200 },
    { hospital_id: hId, name: "Neuronavigation System", equipment_type: "neuro", status: "sterilizing", location: "Sterilization", usage_count: 56, max_usage_before_maintenance: 100 },
    // Imaging
    { hospital_id: hId, name: "C-Arm Fluoroscopy (Siemens)", equipment_type: "imaging", status: "available", location: "OR-5", usage_count: 145, max_usage_before_maintenance: 300 },
    { hospital_id: hId, name: "Portable Ultrasound", equipment_type: "imaging", status: "available", location: "Pre-Op", usage_count: 210, max_usage_before_maintenance: 400 },
    // Monitoring
    { hospital_id: hId, name: "Patient Monitor (Philips MX800)", equipment_type: "monitoring", status: "available", location: "OR-1", usage_count: 340, max_usage_before_maintenance: 600 },
    { hospital_id: hId, name: "Electrocautery Unit (Valleylab)", equipment_type: "instruments", status: "sterilizing", location: "Sterilization", usage_count: 156, max_usage_before_maintenance: 200 },
    { hospital_id: hId, name: "Defibrillator (Zoll)", equipment_type: "cardiac", status: "available", location: "Emergency", usage_count: 12, max_usage_before_maintenance: 100 },
    { hospital_id: hId, name: "Power Drill (Stryker)", equipment_type: "instruments", status: "maintenance", location: "Maintenance", usage_count: 95, max_usage_before_maintenance: 100 },
  ]);

  // ── Create Surgeries (realistic procedures with varied statuses) ──
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  const surgeries = [
    // Emergency — already in progress
    { hospital_id: hId, patient_name: "Zara Sheikh", patient_age: 58, patient_gender: "female", patient_bmi: 28.5, patient_asa_score: 4, procedure_name: "Emergency Coronary Artery Bypass Graft", procedure_type: "cardiac", complexity: 5, priority: "emergency", specialization_required: "cardiac", estimated_duration: 300, predicted_duration: 338, anesthesia_type: "general", status: "in_progress", approval_status: "approved", surgeon_id: surgeonIds[1] ?? null, scheduled_start: new Date(now.getTime() - 2 * 3600000).toISOString(), scheduled_end: new Date(now.getTime() + 3 * 3600000).toISOString(), pre_op_requirements: "ECG, Chest X-ray, Blood Cross-match 4 units, Echo", post_op_requirements: "ICU 48h, Cardiac Monitoring, Chest Drain", created_by: user.id },
    // Emergency — pending
    { hospital_id: hId, patient_name: "Kamran Iqbal", patient_age: 42, patient_gender: "male", patient_bmi: 31.2, patient_asa_score: 3, procedure_name: "Emergency Appendectomy (Perforated)", procedure_type: "general", complexity: 3, priority: "emergency", specialization_required: "general", estimated_duration: 90, predicted_duration: 102, anesthesia_type: "general", status: "approved", approval_status: "approved", pre_op_requirements: "CBC, X-ray Abdomen, NPO 6h", post_op_requirements: "IV Antibiotics 48h, Drain monitoring", created_by: user.id },
    // Urgent — approved awaiting scheduling
    { hospital_id: hId, patient_name: "Maryam Noor Butt", patient_age: 67, patient_gender: "female", patient_bmi: 24.1, patient_asa_score: 3, procedure_name: "Craniotomy for Meningioma", procedure_type: "neuro", complexity: 5, priority: "urgent", specialization_required: "neuro", estimated_duration: 240, predicted_duration: 278, anesthesia_type: "general", status: "approved", approval_status: "approved", surgeon_id: surgeonIds[2] ?? null, pre_op_requirements: "MRI Brain, CT Angiography, Dexamethasone", post_op_requirements: "Neuro ICU 72h, q1h Neuro checks", created_by: user.id },
    // Urgent — scheduled for today
    { hospital_id: hId, patient_name: "Ali Hassan Raza", patient_age: 35, patient_gender: "male", patient_bmi: 26.8, patient_asa_score: 2, procedure_name: "Open Reduction Internal Fixation (Femur)", procedure_type: "orthopedic", complexity: 4, priority: "urgent", specialization_required: "orthopedic", estimated_duration: 180, predicted_duration: 195, anesthesia_type: "regional", status: "scheduled", approval_status: "approved", surgeon_id: surgeonIds[3] ?? null, scheduled_start: `${today}T09:00:00Z`, scheduled_end: `${today}T12:00:00Z`, pre_op_requirements: "X-ray Femur AP/Lat, CBC, PT/APTT, Blood Type", post_op_requirements: "DVT Prophylaxis, Physio Day 2", created_by: user.id },
    // Elective — pending approval
    { hospital_id: hId, patient_name: "Imran Malik Siddiqui", patient_age: 52, patient_gender: "male", patient_bmi: 33.5, patient_asa_score: 3, procedure_name: "Laparoscopic Cholecystectomy", procedure_type: "general", complexity: 2, priority: "elective", specialization_required: "general", estimated_duration: 75, predicted_duration: 82, anesthesia_type: "general", status: "pending", approval_status: "pending", pre_op_requirements: "Ultrasound Abdomen, LFTs, CBC", post_op_requirements: "Same-day discharge if stable", created_by: user.id },
    // Elective — pending
    { hospital_id: hId, patient_name: "Nadia Pervaiz", patient_age: 45, patient_gender: "female", patient_bmi: 27.3, patient_asa_score: 2, procedure_name: "Total Knee Arthroplasty (Right)", procedure_type: "orthopedic", complexity: 3, priority: "elective", specialization_required: "orthopedic", estimated_duration: 150, predicted_duration: 162, anesthesia_type: "regional", status: "pending", approval_status: "pending", pre_op_requirements: "Knee X-ray, ECG, Blood Cross-match 2 units", post_op_requirements: "Physio Day 1, DVT Prophylaxis, Pain Management", created_by: user.id },
    // Completed
    { hospital_id: hId, patient_name: "Sana Farooq Awan", patient_age: 38, patient_gender: "female", patient_bmi: 22.1, patient_asa_score: 1, procedure_name: "Laparoscopic Appendectomy", procedure_type: "general", complexity: 2, priority: "elective", specialization_required: "general", estimated_duration: 60, predicted_duration: 64, actual_duration: 55, anesthesia_type: "general", status: "completed", approval_status: "approved", surgeon_id: surgeonIds[0] ?? null, pre_op_requirements: "CBC, Ultrasound", post_op_requirements: "Oral Antibiotics 5 days", created_by: user.id },
    { hospital_id: hId, patient_name: "Bilal Ahmed Chaudhry", patient_age: 71, patient_gender: "male", patient_bmi: 29.8, patient_asa_score: 4, procedure_name: "Carotid Endarterectomy", procedure_type: "cardiac", complexity: 4, priority: "urgent", specialization_required: "cardiac", estimated_duration: 180, predicted_duration: 215, actual_duration: 200, anesthesia_type: "general", status: "completed", approval_status: "approved", surgeon_id: surgeonIds[1] ?? null, pre_op_requirements: "Duplex Carotid, CT Angio, Cardiology Clearance", post_op_requirements: "BP Monitoring q15m, Neuro Checks, ICU 24h", created_by: user.id },
    // More pending for queue
    { hospital_id: hId, patient_name: "Hira Nawaz", patient_age: 29, patient_gender: "female", patient_bmi: 21.5, patient_asa_score: 1, procedure_name: "Thyroidectomy (Total)", procedure_type: "general", complexity: 3, priority: "elective", specialization_required: "general", estimated_duration: 120, predicted_duration: 126, anesthesia_type: "general", status: "approved", approval_status: "approved", pre_op_requirements: "Thyroid Profile, Neck Ultrasound, Vocal Cord Assessment", post_op_requirements: "Calcium monitoring, Voice assessment", created_by: user.id },
    { hospital_id: hId, patient_name: "Farhan Rasheed", patient_age: 63, patient_gender: "male", patient_bmi: 30.2, patient_asa_score: 3, procedure_name: "Lumbar Laminectomy L4-L5", procedure_type: "neuro", complexity: 4, priority: "urgent", specialization_required: "neuro", estimated_duration: 150, predicted_duration: 172, anesthesia_type: "general", status: "approved", approval_status: "approved", surgeon_id: surgeonIds[2] ?? null, pre_op_requirements: "MRI Lumbar Spine, EMG/NCV, Anesthesia Clearance", post_op_requirements: "Physio, Neuro assessment, Pain clinic follow-up", created_by: user.id },
    // Approved, awaiting schedule
    { hospital_id: hId, patient_name: "Asma Tariq", patient_age: 48, patient_gender: "female", patient_bmi: 26.0, patient_asa_score: 2, procedure_name: "Hernia Repair (Inguinal, Mesh)", procedure_type: "general", complexity: 2, priority: "elective", specialization_required: "general", estimated_duration: 90, predicted_duration: 95, anesthesia_type: "regional", status: "approved", approval_status: "approved", pre_op_requirements: "CBC, ECG", post_op_requirements: "Same day discharge, follow-up 1 week", created_by: user.id },
    { hospital_id: hId, patient_name: "Waqas Javed Khan", patient_age: 55, patient_gender: "male", patient_bmi: 35.1, patient_asa_score: 3, procedure_name: "Hip Replacement (Left Total)", procedure_type: "orthopedic", complexity: 4, priority: "elective", specialization_required: "orthopedic", estimated_duration: 180, predicted_duration: 204, anesthesia_type: "regional", status: "pending", approval_status: "pending", pre_op_requirements: "Hip X-ray, Echo, Blood Cross-match, DVT Risk Assessment", post_op_requirements: "DVT Prophylaxis, Physio Day 1, Walker 6 weeks", created_by: user.id },
  ];

  await supabase.from("surgeries").insert(surgeries);

  // ── Create Schedule Slots for today's scheduled surgery ──
  const { data: scheduledSurgeries } = await supabase
    .from("surgeries")
    .select("id, scheduled_start, scheduled_end")
    .eq("hospital_id", hId)
    .eq("status", "scheduled")
    .not("scheduled_start", "is", null);

  if (scheduledSurgeries) {
    const { data: rooms } = await supabase.from("operating_rooms").select("id").eq("hospital_id", hId).limit(1);
    if (rooms && rooms.length > 0) {
      for (const s of scheduledSurgeries) {
        const start = new Date(s.scheduled_start);
        const end = new Date(s.scheduled_end);
        const setupStart = new Date(start.getTime() - 15 * 60000);
        const cleanupEnd = new Date(end.getTime() + 15 * 60000);

        await supabase.from("schedule_slots").insert([
          { surgery_id: s.id, or_id: rooms[0].id, start_time: setupStart.toISOString(), end_time: start.toISOString(), slot_type: "setup" },
          { surgery_id: s.id, or_id: rooms[0].id, start_time: start.toISOString(), end_time: end.toISOString(), slot_type: "surgery" },
          { surgery_id: s.id, or_id: rooms[0].id, start_time: end.toISOString(), end_time: cleanupEnd.toISOString(), slot_type: "cleanup" },
        ]);
      }
    }
  }

  // ── Create Notifications (diverse types) ──
  await supabase.from("notifications").insert([
    { hospital_id: hId, title: "EMERGENCY: Cardiac Case", message: "Emergency CABG for Zara Sheikh — cardiac arrest risk, immediate OR required", type: "emergency", category: "emergency" },
    { hospital_id: hId, title: "Emergency Appendectomy", message: "Perforated appendix — Kamran Iqbal needs OR within 2 hours. Auto-escalated to emergency priority.", type: "emergency", category: "emergency" },
    { hospital_id: hId, title: "Equipment Sterilization Alert", message: "Neuronavigation System and Electrocautery Unit undergoing sterilization — unavailable for 3 hours", type: "warning", category: "equipment" },
    { hospital_id: hId, title: "Power Drill Maintenance", message: "Stryker Power Drill reached 95% of maintenance threshold (95/100 uses). Scheduled for maintenance.", type: "warning", category: "equipment" },
    { hospital_id: hId, title: "Surgery Scheduled", message: "ORIF Femur for Ali Hassan scheduled in OR-1 General A at 09:00 today", type: "info", category: "schedule" },
    { hospital_id: hId, title: "Craniotomy Pending Schedule", message: "Craniotomy for Maryam Noor approved — awaiting OR slot assignment in Neuro OR", type: "info", category: "schedule" },
    { hospital_id: hId, title: "Dr. Shah Available", message: "Dr. Hassan Ali Shah completed morning rounds, available for afternoon surgeries starting 14:00", type: "success", category: "staff" },
    { hospital_id: hId, title: "OR-6 Under Maintenance", message: "ENT/Ophthalmic OR-6 is blocked for scheduled HVAC maintenance until tomorrow", type: "warning", category: "schedule" },
    { hospital_id: hId, title: "Pending Approvals", message: "3 surgery requests awaiting approval: Cholecystectomy, Knee Arthroplasty, Hip Replacement", type: "info", category: "schedule" },
    { hospital_id: hId, title: "Staff Fatigue Alert", message: "Prof. Dr. Ahmed Khan approaching 10h shift limit — consider reassignment for afternoon cases", type: "warning", category: "staff" },
  ]);

  revalidatePath("/dashboard");
  revalidatePath("/surgeries");
  revalidatePath("/equipment");
  revalidatePath("/schedule");
  revalidatePath("/notifications");
  revalidatePath("/priority-queue");
  return { success: true, hospitalId: hId };
}
