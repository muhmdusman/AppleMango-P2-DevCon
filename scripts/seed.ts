/* ============================================================
   Standalone Seed Script — populates Supabase DB with demo data
   Run: npx tsx scripts/seed.ts
   Uses service role key (bypasses RLS)
   ============================================================ */

import { createClient } from "@supabase/supabase-js";
import { faker } from "@faker-js/faker";
import { ICD10_PROCEDURES, EQUIPMENT_CATALOG } from "../lib/medical-data";

// Load env from .env.local
import { config } from "dotenv";
config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seed() {
  console.log("🚀 Starting seed...\n");

  // Check if hospital already exists — skip if so
  const { data: existing } = await supabase.from("hospitals").select("id").limit(1);
  if (existing && existing.length > 0) {
    console.log("⚠️  Hospital already exists (ID: " + existing[0].id + "). Delete data first or skip.");
    console.log("   To re-seed, run: npx tsx scripts/seed.ts --force");
    if (!process.argv.includes("--force")) {
      process.exit(0);
    }
    // Force mode: delete everything
    console.log("🗑️  Force mode — deleting existing data...");
    const hId = existing[0].id;
    await supabase.from("notifications").delete().eq("hospital_id", hId);
    await supabase.from("schedule_slots").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("surgeries").delete().eq("hospital_id", hId);
    await supabase.from("equipment").delete().eq("hospital_id", hId);
    await supabase.from("staff").delete().eq("hospital_id", hId);
    await supabase.from("operating_rooms").delete().eq("hospital_id", hId);
    await supabase.from("hospitals").delete().eq("id", hId);
    console.log("   ✅ Cleared existing data.\n");
  }

  // Get a user to set as created_by (first auth user)
  const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1 });
  const userId = usersData?.users?.[0]?.id ?? null;
  if (!userId) {
    console.error("❌ No auth users found. Register at least one user first.");
    process.exit(1);
  }
  console.log(`👤 Using user ID: ${userId}`);

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

  if (hospError || !hospital) {
    console.error("❌ Failed to create hospital:", hospError?.message);
    process.exit(1);
  }
  const hId = hospital.id;
  console.log(`🏥 Hospital created: ${hId}`);

  // ── Create Operating Rooms ──
  const { data: roomsInserted } = await supabase.from("operating_rooms").insert([
    { hospital_id: hId, name: "OR-1 General A", room_type: "general", status: "available", capabilities: ["general", "laparoscopic", "emergency"] },
    { hospital_id: hId, name: "OR-2 General B", room_type: "general", status: "occupied", capabilities: ["general", "bariatric", "trauma"] },
    { hospital_id: hId, name: "OR-3 Cardiac", room_type: "cardiac", status: "available", capabilities: ["cardiac", "vascular", "thoracic"] },
    { hospital_id: hId, name: "OR-4 Neuro", room_type: "neuro", status: "available", capabilities: ["neuro", "spine", "cranial"] },
    { hospital_id: hId, name: "OR-5 Orthopedic", room_type: "orthopedic", status: "available", capabilities: ["orthopedic", "trauma", "arthroplasty"] },
    { hospital_id: hId, name: "OR-6 ENT/Ophthalmic", room_type: "ent", status: "maintenance", capabilities: ["ent", "ophthalmic", "dental"] },
  ]).select("id, name, room_type");

  const roomIds = roomsInserted?.map(r => r.id) ?? [];
  console.log(`🏗️  ${roomIds.length} operating rooms created`);

  // ── Create Staff (31 members) ──
  const pakistaniFirstNames = ["Ahmed", "Muhammad", "Ali", "Hassan", "Bilal", "Usman", "Saad", "Farhan", "Kamran", "Waqas", "Sana", "Fatima", "Ayesha", "Nadia", "Hira", "Maryam", "Rabia", "Zainab", "Asma", "Noor", "Omar", "Imran", "Tariq", "Rehan"];
  const pakistaniLastNames = ["Khan", "Malik", "Zaidi", "Tariq", "Shah", "Qureshi", "Akhtar", "Haider", "Hussain", "Mehmood", "Raza", "Butt", "Chaudhry", "Siddiqui", "Nawaz", "Mirza", "Sheikh", "Abbasi"];
  const specializations = ["general", "cardiac", "neuro", "orthopedic", "ent"];

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
  for (let i = 0; i < 10; i++) {
    staffData.push({ hospital_id: hId, full_name: `Dr. ${pkName()}`, role: "surgeon", specialization: specializations[i % specializations.length], email: faker.internet.email().toLowerCase(), max_hours_per_day: faker.helpers.arrayElement([10, 12]) });
  }
  for (let i = 0; i < 5; i++) {
    staffData.push({ hospital_id: hId, full_name: `Dr. ${pkName()}`, role: "anesthesiologist", specialization: specializations[i % specializations.length], email: faker.internet.email().toLowerCase(), max_hours_per_day: faker.helpers.arrayElement([10, 12]) });
  }
  for (let i = 0; i < 10; i++) {
    staffData.push({ hospital_id: hId, full_name: `Nurse ${pkName()}`, role: "nurse", email: faker.internet.email().toLowerCase(), max_hours_per_day: 8 });
  }
  staffData.push({ hospital_id: hId, full_name: `Dr. ${pkName()}`, role: "or_manager", email: faker.internet.email().toLowerCase(), max_hours_per_day: 10 });
  staffData.push({ hospital_id: hId, full_name: `Dr. ${pkName()}`, role: "or_manager", email: faker.internet.email().toLowerCase(), max_hours_per_day: 10 });
  for (let i = 0; i < 3; i++) {
    staffData.push({ hospital_id: hId, full_name: pkName(), role: "scheduler", email: faker.internet.email().toLowerCase(), max_hours_per_day: 8 });
  }
  // Current user as staff
  staffData.push({ hospital_id: hId, full_name: "Admin User", role: "or_manager", email: usersData.users[0].email ?? "", max_hours_per_day: 12 });

  const { data: staffInserted, error: staffErr } = await supabase.from("staff").insert(staffData).select("id, role, specialization");
  if (staffErr) {
    console.error("❌ Staff insertion failed:", staffErr.message);
    process.exit(1);
  }
  const surgeonIds = staffInserted?.filter(s => s.role === "surgeon").map(s => s.id) ?? [];
  console.log(`👨‍⚕️ ${staffInserted?.length ?? 0} staff members created (${surgeonIds.length} surgeons)`);

  // ── Create Equipment ──
  const equipmentData: Record<string, unknown>[] = [];
  const eqStatuses = ["available", "available", "available", "in_use", "sterilizing", "maintenance"];

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
  const { error: eqErr } = await supabase.from("equipment").insert(equipmentData);
  if (eqErr) console.warn("⚠️  Equipment insert warning:", eqErr.message);
  else console.log(`🔧 ${equipmentData.length} equipment items created`);

  // ── Generate Surgeries ──
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const anesthesiaTypes = ["general", "regional", "local", "sedation"];
  const genders = ["male", "female"];

  // Pre-generate 60 unique patients
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
  console.log(`🧑‍🤝‍🧑 ${patientPool.length} unique patients generated`);

  function randomPatient() { return faker.helpers.arrayElement(patientPool); }
  function randomProcedure() { return faker.helpers.arrayElement(ICD10_PROCEDURES); }

  const allSurgeries: Record<string, unknown>[] = [];

  // --- 8 Emergencies ---
  for (let i = 0; i < 8; i++) {
    const proc = randomProcedure();
    const pat = randomPatient();
    const status = i < 2 ? "in_progress" : i < 5 ? "approved" : "pending";
    const duration = proc.avgDuration + faker.number.int({ min: -20, max: 60 });
    const predicted = Math.round(duration * (1 + proc.complexity * 0.08));
    const scheduledStart = status === "in_progress" ? new Date(now.getTime() - faker.number.int({ min: 1, max: 4 }) * 3600000).toISOString() : undefined;
    const scheduledEnd = scheduledStart ? new Date(new Date(scheduledStart).getTime() + duration * 60000).toISOString() : undefined;

    allSurgeries.push({
      hospital_id: hId, patient_name: pat.name, patient_age: pat.age, patient_gender: pat.gender,
      patient_bmi: pat.bmi, patient_asa_score: faker.helpers.arrayElement([3, 4, 5]),
      procedure_name: `Emergency ${proc.name}`, procedure_type: proc.category,
      complexity: Math.min(5, proc.complexity + 1), priority: "emergency", specialization_required: proc.specialization,
      estimated_duration: duration, predicted_duration: predicted, anesthesia_type: "general",
      status, approval_status: status === "pending" ? "pending" : "approved",
      surgeon_id: faker.helpers.arrayElement(surgeonIds) ?? null,
      scheduled_start: scheduledStart, scheduled_end: scheduledEnd,
      pre_op_requirements: proc.preOp, post_op_requirements: proc.postOp,
      patient_comorbidities: pat.comorbidities,
      created_by: userId,
      created_at: new Date(now.getTime() - faker.number.int({ min: 0, max: 6 }) * 3600000).toISOString(),
    });
  }

  // --- 20 Urgent ---
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
      patient_bmi: pat.bmi, patient_asa_score: faker.helpers.arrayElement([2, 3, 4]),
      procedure_name: proc.name, procedure_type: proc.category,
      complexity: proc.complexity, priority: "urgent", specialization_required: proc.specialization,
      estimated_duration: duration, predicted_duration: predicted, anesthesia_type: faker.helpers.arrayElement(anesthesiaTypes),
      status, approval_status: status === "pending" ? "pending" : "approved",
      surgeon_id: faker.helpers.arrayElement(surgeonIds) ?? null,
      scheduled_start: scheduledStart, scheduled_end: scheduledEnd,
      or_id: status === "scheduled" && roomIds.length > 0 ? roomIds[i % roomIds.length] : undefined,
      pre_op_requirements: proc.preOp, post_op_requirements: proc.postOp,
      patient_comorbidities: pat.comorbidities,
      created_by: userId,
      created_at: new Date(now.getTime() - faker.number.int({ min: 12, max: 96 }) * 3600000).toISOString(),
    });
  }

  // --- 60 Elective ---
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

    const actualStart = status === "completed" ? new Date(now.getTime() - faker.number.int({ min: 2, max: 10 }) * 3600000).toISOString() : undefined;
    const actualEnd = status === "completed" ? new Date(new Date(actualStart!).getTime() + (duration + faker.number.int({ min: -10, max: 20 })) * 60000).toISOString() : undefined;
    const actualDuration = status === "completed" ? duration + faker.number.int({ min: -12, max: 25 }) : undefined;

    allSurgeries.push({
      hospital_id: hId, patient_name: pat.name, patient_age: pat.age, patient_gender: pat.gender,
      patient_bmi: pat.bmi, patient_asa_score: faker.helpers.arrayElement([1, 2, 3]),
      procedure_name: proc.name, procedure_type: proc.category,
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
      created_by: userId,
      created_at: new Date(now.getTime() - faker.number.int({ min: 24, max: 720 }) * 3600000).toISOString(),
    });
  }

  // --- 30 Historical Completed ---
  for (let i = 0; i < 30; i++) {
    const proc = randomProcedure();
    const pat = randomPatient();
    const duration = proc.avgDuration + faker.number.int({ min: -10, max: 20 });
    const hoursAgo = faker.number.int({ min: 1, max: 14 });
    const aStart = new Date(now.getTime() - hoursAgo * 3600000).toISOString();
    const aEnd = new Date(new Date(aStart).getTime() + duration * 60000).toISOString();

    allSurgeries.push({
      hospital_id: hId, patient_name: pat.name, patient_age: pat.age, patient_gender: pat.gender,
      patient_bmi: pat.bmi, patient_asa_score: faker.helpers.arrayElement([1, 2, 3]),
      procedure_name: proc.name, procedure_type: proc.category, complexity: proc.complexity,
      priority: faker.helpers.weightedArrayElement([{ value: "elective", weight: 6 }, { value: "urgent", weight: 3 }, { value: "emergency", weight: 1 }]),
      specialization_required: proc.specialization, estimated_duration: duration,
      predicted_duration: Math.round(duration * 1.05), actual_duration: duration + faker.number.int({ min: -8, max: 15 }),
      anesthesia_type: faker.helpers.arrayElement(anesthesiaTypes),
      status: "completed", approval_status: "approved",
      surgeon_id: faker.helpers.arrayElement(surgeonIds) ?? null,
      scheduled_start: aStart, scheduled_end: aEnd, actual_start: aStart, actual_end: aEnd,
      or_id: roomIds.length > 0 ? roomIds[i % roomIds.length] : undefined,
      pre_op_requirements: proc.preOp, post_op_requirements: proc.postOp,
      created_by: userId,
      created_at: new Date(now.getTime() - faker.number.int({ min: 48, max: 720 }) * 3600000).toISOString(),
    });
  }

  // Insert surgeries in batches of 50
  let surgeryCount = 0;
  for (let i = 0; i < allSurgeries.length; i += 50) {
    const batch = allSurgeries.slice(i, i + 50);
    const { error: sErr } = await supabase.from("surgeries").insert(batch);
    if (sErr) console.warn(`⚠️  Surgery batch ${i / 50 + 1} warning:`, sErr.message);
    else surgeryCount += batch.length;
  }
  console.log(`🔪 ${surgeryCount} surgeries created (8 emergency, 20 urgent, 60 elective, 30 historical)`);

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
    console.log(`📅 ${slotBatch.length} schedule slots created for ${scheduledSurgeries.length} scheduled surgeries`);
  }

  // ── Create 50 Notifications ──
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
  const { error: notifErr } = await supabase.from("notifications").insert(notifData);
  if (notifErr) console.warn("⚠️  Notifications warning:", notifErr.message);
  else console.log(`🔔 50 notifications created`);

  // ── Link user to hospital profiles ──
  const { error: profileErr } = await supabase
    .from("profiles")
    .update({ hospital_id: hId, role: "admin" })
    .eq("id", userId);
  if (profileErr) console.warn("⚠️  Profile update warning:", profileErr.message);
  else console.log(`👤 User profile linked to hospital`);

  console.log("\n✅ Seed complete!");
  console.log(`   Hospital: ${hId}`);
  console.log(`   Staff: ${staffInserted?.length ?? 0}`);
  console.log(`   Patients: ${patientPool.length}`);
  console.log(`   Surgeries: ${surgeryCount}`);
  console.log(`   Equipment: ${equipmentData.length}`);
  console.log(`   Notifications: 50`);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
