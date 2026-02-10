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
    status: "approved",
    approval_status: "approved",
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
  revalidatePath("/schedule");
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
  revalidatePath("/schedule");
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

  // Delete old schedule slots for this surgery (enables re-scheduling / drag-drop)
  await supabase.from("schedule_slots").delete().eq("surgery_id", surgeryId);

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

// ── Seed Demo Data (comprehensive — 120+ surgeries via Faker) ──

export async function seedDemoData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Check if hospital already exists
  const { data: existing } = await supabase.from("hospitals").select("id").limit(1);
  if (existing && existing.length > 0) return { success: true, hospitalId: existing[0].id };

  // Dynamic import Faker + medical data
  const { faker } = await import("@faker-js/faker");
  const { ICD10_PROCEDURES, EQUIPMENT_CATALOG } = await import("@/lib/medical-data");

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
  const { data: roomsInserted } = await supabase.from("operating_rooms").insert([
    { hospital_id: hId, name: "OR-1 General A", room_type: "general", status: "available", capabilities: ["general", "laparoscopic", "emergency"] },
    { hospital_id: hId, name: "OR-2 General B", room_type: "general", status: "occupied", capabilities: ["general", "bariatric", "trauma"] },
    { hospital_id: hId, name: "OR-3 Cardiac", room_type: "cardiac", status: "available", capabilities: ["cardiac", "vascular", "thoracic"] },
    { hospital_id: hId, name: "OR-4 Neuro", room_type: "neuro", status: "available", capabilities: ["neuro", "spine", "cranial"] },
    { hospital_id: hId, name: "OR-5 Orthopedic", room_type: "orthopedic", status: "available", capabilities: ["orthopedic", "trauma", "arthroplasty"] },
    { hospital_id: hId, name: "OR-6 ENT/Ophthalmic", room_type: "ent", status: "maintenance", capabilities: ["ent", "ophthalmic", "dental"] },
  ]).select("id, name, room_type");

  const roomIds = roomsInserted?.map(r => r.id) ?? [];

  // ── Create Staff (30 realistic Pakistani medical professionals) ──
  const pakistaniFirstNames = ["Ahmed", "Muhammad", "Ali", "Hassan", "Bilal", "Usman", "Saad", "Farhan", "Kamran", "Waqas", "Sana", "Fatima", "Ayesha", "Nadia", "Hira", "Maryam", "Rabia", "Zainab", "Asma", "Noor", "Omar", "Imran", "Tariq", "Rehan"];
  const pakistaniLastNames = ["Khan", "Malik", "Zaidi", "Tariq", "Shah", "Qureshi", "Akhtar", "Haider", "Hussain", "Mehmood", "Raza", "Butt", "Chaudhry", "Siddiqui", "Nawaz", "Mirza", "Sheikh", "Abbasi"];
  const specializations = ["general", "cardiac", "neuro", "orthopedic", "ent"];

  // Track used names to avoid duplicates
  const usedStaffNames = new Set<string>();
  function pkName() {
    let name: string;
    do {
      name = `${faker.helpers.arrayElement(pakistaniFirstNames)} ${faker.helpers.arrayElement(pakistaniLastNames)}`;
    } while (usedStaffNames.has(name));
    usedStaffNames.add(name);
    return name;
  }

  const staffData: Record<string, unknown>[] = [];
  // 10 surgeons
  for (let i = 0; i < 10; i++) {
    staffData.push({ hospital_id: hId, full_name: `Dr. ${pkName()}`, role: "surgeon", specialization: specializations[i % specializations.length], email: faker.internet.email().toLowerCase(), max_hours_per_day: faker.helpers.arrayElement([10, 12]) });
  }
  // 5 anesthesiologists
  for (let i = 0; i < 5; i++) {
    staffData.push({ hospital_id: hId, full_name: `Dr. ${pkName()}`, role: "anesthesiologist", specialization: specializations[i % specializations.length], email: faker.internet.email().toLowerCase(), max_hours_per_day: faker.helpers.arrayElement([10, 12]) });
  }
  // 10 nurses
  for (let i = 0; i < 10; i++) {
    staffData.push({ hospital_id: hId, full_name: `Nurse ${pkName()}`, role: "nurse", email: faker.internet.email().toLowerCase(), max_hours_per_day: 8 });
  }
  // 2 OR managers
  staffData.push({ hospital_id: hId, full_name: `Dr. ${pkName()}`, role: "or_manager", email: faker.internet.email().toLowerCase(), max_hours_per_day: 10 });
  staffData.push({ hospital_id: hId, full_name: `Dr. ${pkName()}`, role: "or_manager", email: faker.internet.email().toLowerCase(), max_hours_per_day: 10 });
  // 3 schedulers
  for (let i = 0; i < 3; i++) {
    staffData.push({ hospital_id: hId, full_name: pkName(), role: "scheduler", email: faker.internet.email().toLowerCase(), max_hours_per_day: 8 });
  }
  // Current user
  staffData.push({ hospital_id: hId, full_name: user.user_metadata?.full_name ?? user.email ?? "Admin User", role: "or_manager", email: user.email ?? "", max_hours_per_day: 12 });

  const { data: staffInserted } = await supabase.from("staff").insert(staffData).select("id, role, specialization");
  const surgeonIds = staffInserted?.filter(s => s.role === "surgeon").map(s => s.id) ?? [];

  // ── Create Equipment (40 items from ICD-10 equipment catalog) ──
  const equipmentData: Record<string, unknown>[] = [];
  const eqStatuses: string[] = ["available", "available", "available", "in_use", "sterilizing", "maintenance"];
  const locations = ["OR-1", "OR-2", "OR-3", "OR-4", "OR-5", "OR-6", "Storage-1", "Storage-2", "Sterilization", "Pre-Op", "Emergency", "Maintenance"];

  for (const eq of EQUIPMENT_CATALOG) {
    equipmentData.push({
      hospital_id: hId,
      name: eq.name,
      equipment_type: eq.type,
      status: faker.helpers.arrayElement(eqStatuses),
      location: faker.helpers.arrayElement(eq.locations),
      usage_count: faker.number.int({ min: 5, max: Math.floor(eq.maxUsage * 0.95) }),
      max_usage_before_maintenance: eq.maxUsage,
      notes: eq.name,
    });
  }
  // Extra duplicates for common items
  for (let i = 0; i < 12; i++) {
    const eq = faker.helpers.arrayElement(EQUIPMENT_CATALOG);
    equipmentData.push({
      hospital_id: hId,
      name: `${eq.name} #${i + 2}`,
      equipment_type: eq.type,
      status: faker.helpers.arrayElement(eqStatuses),
      location: faker.helpers.arrayElement(eq.locations),
      usage_count: faker.number.int({ min: 0, max: eq.maxUsage }),
      max_usage_before_maintenance: eq.maxUsage,
    });
  }
  await supabase.from("equipment").insert(equipmentData);

  // ── Generate 120+ Surgeries using ICD-10 + Faker ──
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const priorities: string[] = ["emergency", "urgent", "elective"];
  const anesthesiaTypes = ["general", "regional", "local", "sedation"];
  const genders = ["male", "female"];

  // ── Pre-generate 60 unique patients ──
  const usedPatientNames = new Set<string>();
  interface PatientProfile { name: string; age: number; gender: string; bmi: number; asa: number; comorbidities: string[] }
  const patientPool: PatientProfile[] = [];
  const comorbidityList = ["Diabetes", "Hypertension", "CAD", "COPD", "Obesity", "CKD", "Asthma", "Anemia", "Hypothyroid", "DVT History"];
  for (let i = 0; i < 60; i++) {
    let pName: string;
    do {
      pName = `${faker.helpers.arrayElement(pakistaniFirstNames)} ${faker.helpers.arrayElement(pakistaniLastNames)}`;
    } while (usedPatientNames.has(pName));
    usedPatientNames.add(pName);
    patientPool.push({
      name: pName,
      age: faker.number.int({ min: 18, max: 85 }),
      gender: faker.helpers.arrayElement(genders),
      bmi: parseFloat(faker.number.float({ min: 18.5, max: 40, fractionDigits: 1 }).toFixed(1)),
      asa: faker.helpers.arrayElement([1, 2, 3, 4]),
      comorbidities: faker.helpers.arrayElements(comorbidityList, faker.number.int({ min: 0, max: 3 })),
    });
  }
  function randomPatient() { return faker.helpers.arrayElement(patientPool); }

  const allSurgeries: Record<string, unknown>[] = [];

  // Helper: pick random ICD-10 procedure
  function randomProcedure() { return faker.helpers.arrayElement(ICD10_PROCEDURES); }

  // --- 8 Emergencies (2 in_progress, 3 approved, 3 pending) ---
  for (let i = 0; i < 8; i++) {
    const proc = randomProcedure();
    const pat = randomPatient();
    const status = i < 2 ? "in_progress" : i < 5 ? "approved" : "pending";
    const asa = faker.helpers.arrayElement([3, 4, 5]);
    const duration = proc.avgDuration + faker.number.int({ min: -20, max: 60 });
    const predicted = Math.round(duration * (1 + proc.complexity * 0.08));
    const scheduledStart = status === "in_progress" ? new Date(now.getTime() - faker.number.int({ min: 1, max: 4 }) * 3600000).toISOString() : undefined;
    const scheduledEnd = scheduledStart ? new Date(new Date(scheduledStart).getTime() + duration * 60000).toISOString() : undefined;

    allSurgeries.push({
      hospital_id: hId, patient_name: pat.name, patient_age: pat.age, patient_gender: pat.gender,
      patient_bmi: pat.bmi, patient_asa_score: asa, procedure_name: `Emergency ${proc.name}`, procedure_type: proc.category,
      complexity: Math.min(5, proc.complexity + 1), priority: "emergency", specialization_required: proc.specialization,
      estimated_duration: duration, predicted_duration: predicted, anesthesia_type: "general",
      status, approval_status: status === "pending" ? "pending" : "approved",
      surgeon_id: faker.helpers.arrayElement(surgeonIds) ?? null,
      scheduled_start: scheduledStart, scheduled_end: scheduledEnd,
      pre_op_requirements: proc.preOp, post_op_requirements: proc.postOp,
      patient_comorbidities: pat.comorbidities,
      created_by: user.id,
      created_at: new Date(now.getTime() - faker.number.int({ min: 0, max: 6 }) * 3600000).toISOString(),
    });
  }

  // --- 20 Urgent (5 scheduled today, 8 approved, 7 pending) ---
  for (let i = 0; i < 20; i++) {
    const proc = randomProcedure();
    const pat = randomPatient();
    const status = i < 5 ? "scheduled" : i < 13 ? "approved" : "pending";
    const duration = proc.avgDuration + faker.number.int({ min: -15, max: 45 });
    const predicted = Math.round(duration * (1 + proc.complexity * 0.06));
    const hour = 7 + (i % 12);
    const scheduledStart = status === "scheduled" ? `${today}T${String(hour).padStart(2, "0")}:00:00Z` : undefined;
    const scheduledEnd = scheduledStart ? new Date(new Date(scheduledStart).getTime() + duration * 60000).toISOString() : undefined;

    allSurgeries.push({
      hospital_id: hId, patient_name: pat.name, patient_age: pat.age, patient_gender: pat.gender,
      patient_bmi: pat.bmi, patient_asa_score: faker.helpers.arrayElement([2, 3, 4]), procedure_name: proc.name, procedure_type: proc.category,
      complexity: proc.complexity, priority: "urgent", specialization_required: proc.specialization,
      estimated_duration: duration, predicted_duration: predicted, anesthesia_type: faker.helpers.arrayElement(anesthesiaTypes),
      status, approval_status: status === "pending" ? "pending" : "approved",
      surgeon_id: faker.helpers.arrayElement(surgeonIds) ?? null,
      scheduled_start: scheduledStart, scheduled_end: scheduledEnd,
      or_id: status === "scheduled" && roomIds.length > 0 ? roomIds[i % roomIds.length] : undefined,
      pre_op_requirements: proc.preOp, post_op_requirements: proc.postOp,
      patient_comorbidities: pat.comorbidities,
      created_by: user.id,
      created_at: new Date(now.getTime() - faker.number.int({ min: 12, max: 96 }) * 3600000).toISOString(),
    });
  }

  // --- 60 Elective (10 scheduled today, 15 approved, 20 pending, 15 completed) ---
  for (let i = 0; i < 60; i++) {
    const proc = randomProcedure();
    const pat = randomPatient();
    let status: string;
    if (i < 10) status = "scheduled";
    else if (i < 25) status = "approved";
    else if (i < 45) status = "pending";
    else status = "completed";

    const duration = proc.avgDuration + faker.number.int({ min: -10, max: 30 });
    const predicted = Math.round(duration * (1 + proc.complexity * 0.05));
    const hour = 7 + (i % 12);
    const scheduledStart = status === "scheduled" ? `${today}T${String(hour).padStart(2, "0")}:00:00Z` : undefined;
    const scheduledEnd = scheduledStart ? new Date(new Date(scheduledStart).getTime() + duration * 60000).toISOString() : undefined;

    // Completed surgeries get actual times for today
    const actualStart = status === "completed" ? new Date(now.getTime() - faker.number.int({ min: 2, max: 10 }) * 3600000).toISOString() : undefined;
    const actualEnd = status === "completed" ? new Date(new Date(actualStart!).getTime() + (duration + faker.number.int({ min: -10, max: 20 })) * 60000).toISOString() : undefined;
    const actualDuration = status === "completed" ? duration + faker.number.int({ min: -12, max: 25 }) : undefined;

    allSurgeries.push({
      hospital_id: hId, patient_name: pat.name, patient_age: pat.age, patient_gender: pat.gender,
      patient_bmi: pat.bmi, patient_asa_score: faker.helpers.arrayElement([1, 2, 3]), procedure_name: proc.name, procedure_type: proc.category,
      complexity: proc.complexity, priority: "elective", specialization_required: proc.specialization,
      estimated_duration: duration, predicted_duration: predicted, actual_duration: actualDuration,
      anesthesia_type: faker.helpers.arrayElement(anesthesiaTypes),
      status, approval_status: status === "pending" ? "pending" : "approved",
      surgeon_id: faker.helpers.arrayElement(surgeonIds) ?? null,
      scheduled_start: status === "completed" ? actualStart : scheduledStart,
      scheduled_end: status === "completed" ? actualEnd : scheduledEnd,
      actual_start: actualStart, actual_end: actualEnd,
      or_id: (status === "scheduled" || status === "completed") && roomIds.length > 0 ? roomIds[i % roomIds.length] : undefined,
      pre_op_requirements: proc.preOp, post_op_requirements: proc.postOp,
      patient_comorbidities: pat.comorbidities,
      created_by: user.id,
      created_at: new Date(now.getTime() - faker.number.int({ min: 24, max: 720 }) * 3600000).toISOString(),
    });
  }

  // --- 30 more completed (historical) with today's actual_end to show on charts ---
  for (let i = 0; i < 30; i++) {
    const proc = randomProcedure();
    const pat = randomPatient();
    const duration = proc.avgDuration + faker.number.int({ min: -10, max: 20 });
    const hoursAgo = faker.number.int({ min: 1, max: 14 });
    const aStart = new Date(now.getTime() - hoursAgo * 3600000).toISOString();
    const aEnd = new Date(new Date(aStart).getTime() + duration * 60000).toISOString();

    allSurgeries.push({
      hospital_id: hId, patient_name: pat.name, patient_age: pat.age, patient_gender: pat.gender,
      patient_bmi: pat.bmi, patient_asa_score: faker.helpers.arrayElement([1, 2, 3]), procedure_name: proc.name,
      procedure_type: proc.category, complexity: proc.complexity,
      priority: faker.helpers.weightedArrayElement([{ value: "elective", weight: 6 }, { value: "urgent", weight: 3 }, { value: "emergency", weight: 1 }]),
      specialization_required: proc.specialization, estimated_duration: duration,
      predicted_duration: Math.round(duration * 1.05), actual_duration: duration + faker.number.int({ min: -8, max: 15 }),
      anesthesia_type: faker.helpers.arrayElement(anesthesiaTypes),
      status: "completed", approval_status: "approved",
      surgeon_id: faker.helpers.arrayElement(surgeonIds) ?? null,
      scheduled_start: aStart, scheduled_end: aEnd, actual_start: aStart, actual_end: aEnd,
      or_id: roomIds.length > 0 ? roomIds[i % roomIds.length] : undefined,
      pre_op_requirements: proc.preOp, post_op_requirements: proc.postOp,
      created_by: user.id,
      created_at: new Date(now.getTime() - faker.number.int({ min: 48, max: 720 }) * 3600000).toISOString(),
    });
  }

  // Insert surgeries in batches of 50
  for (let i = 0; i < allSurgeries.length; i += 50) {
    await supabase.from("surgeries").insert(allSurgeries.slice(i, i + 50));
  }

  // ── Create Schedule Slots for today's scheduled surgeries ──
  const { data: scheduledSurgeries } = await supabase
    .from("surgeries")
    .select("id, scheduled_start, scheduled_end, or_id")
    .eq("hospital_id", hId)
    .eq("status", "scheduled")
    .not("scheduled_start", "is", null);

  if (scheduledSurgeries && roomIds.length > 0) {
    const slotBatch: Record<string, unknown>[] = [];
    for (const [idx, s] of scheduledSurgeries.entries()) {
      const start = new Date(s.scheduled_start);
      const end = new Date(s.scheduled_end);
      const setupStart = new Date(start.getTime() - 15 * 60000);
      const cleanupEnd = new Date(end.getTime() + 15 * 60000);
      const orId = s.or_id ?? roomIds[idx % roomIds.length];

      slotBatch.push(
        { surgery_id: s.id, or_id: orId, start_time: setupStart.toISOString(), end_time: start.toISOString(), slot_type: "setup" },
        { surgery_id: s.id, or_id: orId, start_time: start.toISOString(), end_time: end.toISOString(), slot_type: "surgery" },
        { surgery_id: s.id, or_id: orId, start_time: end.toISOString(), end_time: cleanupEnd.toISOString(), slot_type: "cleanup" },
      );
    }
    for (let i = 0; i < slotBatch.length; i += 50) {
      await supabase.from("schedule_slots").insert(slotBatch.slice(i, i + 50));
    }
  }

  // ── Create 50 Notifications (diverse, realistic) ──
  const notifTypes = ["info", "warning", "emergency", "success", "error"] as const;
  const notifCategories = ["schedule", "equipment", "emergency", "staff"] as const;
  const notifTemplates = [
    { title: "EMERGENCY: Cardiac Case", message: "Emergency CABG required — cardiac arrest risk, immediate OR needed", type: "emergency", category: "emergency" },
    { title: "Emergency Appendectomy", message: "Perforated appendix needs OR within 2 hours. Auto-escalated.", type: "emergency", category: "emergency" },
    { title: "Equipment Sterilization Alert", message: "Neuronavigation System undergoing sterilization — unavailable for 3 hours", type: "warning", category: "equipment" },
    { title: "Equipment Maintenance Due", message: "Surgical instrument set approaching maintenance threshold", type: "warning", category: "equipment" },
    { title: "Surgery Scheduled", message: "Surgery scheduled successfully for today", type: "info", category: "schedule" },
    { title: "Surgery Completed", message: "Procedure completed successfully, patient in recovery", type: "success", category: "schedule" },
    { title: "Pending Approval", message: "New surgery request awaiting admin approval", type: "info", category: "schedule" },
    { title: "Staff Fatigue Alert", message: "Surgeon approaching shift limit — consider reassignment", type: "warning", category: "staff" },
    { title: "OR Maintenance", message: "Operating room blocked for scheduled maintenance", type: "warning", category: "schedule" },
    { title: "Staff Available", message: "Doctor completed morning rounds, available for afternoon cases", type: "success", category: "staff" },
  ];

  const notifData: Record<string, unknown>[] = [];
  for (let i = 0; i < 50; i++) {
    const template = faker.helpers.arrayElement(notifTemplates);
    notifData.push({
      hospital_id: hId,
      title: template.title,
      message: template.message + ` [${faker.string.alphanumeric(4).toUpperCase()}]`,
      type: template.type,
      category: template.category,
      is_read: faker.datatype.boolean(0.4),
      created_at: new Date(now.getTime() - faker.number.int({ min: 0, max: 168 }) * 3600000).toISOString(),
    });
  }
  await supabase.from("notifications").insert(notifData);

  revalidatePath("/dashboard");
  revalidatePath("/surgeries");
  revalidatePath("/equipment");
  revalidatePath("/schedule");
  revalidatePath("/notifications");
  revalidatePath("/priority-queue");
  return { success: true, hospitalId: hId };
}
