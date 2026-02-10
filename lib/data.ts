/* ============================================================
   Supabase data-access helpers (server-side)
   Centralizes all DB queries for the scheduler
   ============================================================ */
"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  Surgery, OperatingRoom, Staff, Equipment,
  Notification, ScheduleSlot, DashboardStats, Hospital,
} from "@/lib/types";

// ── Hospitals ──────────────────────────────────────────────
export async function getHospitals(): Promise<Hospital[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("hospitals").select("*").order("name");
  return (data as Hospital[]) ?? [];
}

export async function getDefaultHospitalId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("hospitals").select("id").limit(1).single();
  return data?.id ?? null;
}

// ── Operating Rooms ────────────────────────────────────────
export async function getOperatingRooms(hospitalId: string): Promise<OperatingRoom[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("operating_rooms")
    .select("*")
    .eq("hospital_id", hospitalId)
    .order("name");
  return (data as OperatingRoom[]) ?? [];
}

// ── Staff ──────────────────────────────────────────────────
export async function getStaff(hospitalId: string, role?: string): Promise<Staff[]> {
  const supabase = await createClient();
  let q = supabase.from("staff").select("*").eq("hospital_id", hospitalId);
  if (role) q = q.eq("role", role);
  const { data } = await q.order("full_name");
  return (data as Staff[]) ?? [];
}

// ── Equipment ──────────────────────────────────────────────
export async function getEquipment(hospitalId: string): Promise<Equipment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("equipment")
    .select("*")
    .eq("hospital_id", hospitalId)
    .order("name");
  return (data as Equipment[]) ?? [];
}

// ── Surgeries ──────────────────────────────────────────────
export async function getSurgeries(
  hospitalId: string,
  filters?: { status?: string; priority?: string; search?: string; page?: number; pageSize?: number }
): Promise<{ data: Surgery[]; count: number }> {
  const supabase = await createClient();
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("surgeries")
    .select("*, operating_room:operating_rooms(*), surgeon:staff!surgeries_surgeon_id_fkey(*)", { count: "exact" })
    .eq("hospital_id", hospitalId);

  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.priority) q = q.eq("priority", filters.priority);
  if (filters?.search) q = q.or(`patient_name.ilike.%${filters.search}%,procedure_name.ilike.%${filters.search}%`);

  const { data, count } = await q.order("created_at", { ascending: false }).range(from, to);
  return { data: (data as Surgery[]) ?? [], count: count ?? 0 };
}

export async function getSurgeryById(id: string): Promise<Surgery | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("surgeries")
    .select("*, operating_room:operating_rooms(*), surgeon:staff!surgeries_surgeon_id_fkey(*)")
    .eq("id", id)
    .single();
  return (data as Surgery) ?? null;
}

// ── Schedule Slots ─────────────────────────────────────────
export async function getScheduleSlots(
  hospitalId: string,
  date: string
): Promise<ScheduleSlot[]> {
  const supabase = await createClient();
  const startOfDay = `${date}T00:00:00`;
  const endOfDay = `${date}T23:59:59`;

  const { data } = await supabase
    .from("schedule_slots")
    .select("*, surgery:surgeries(*), operating_room:operating_rooms(*)")
    .gte("start_time", startOfDay)
    .lte("start_time", endOfDay)
    .order("start_time");

  return (data as ScheduleSlot[]) ?? [];
}

// ── Notifications ──────────────────────────────────────────
export async function getNotifications(hospitalId: string, limit = 50): Promise<Notification[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("hospital_id", hospitalId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as Notification[]) ?? [];
}

export async function getUnreadNotificationCount(hospitalId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("hospital_id", hospitalId)
    .eq("is_read", false);
  return count ?? 0;
}

// ── Dashboard Stats ────────────────────────────────────────
export async function getDashboardStats(hospitalId: string): Promise<DashboardStats> {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];
  const startOfDay = `${today}T00:00:00`;
  const endOfDay = `${today}T23:59:59`;

  // Run queries in parallel for performance
  const [totalRes, todayRes, emergencyRes, completedRes, pendingRes, equipAlertRes, orRes, occupiedRes] =
    await Promise.all([
      supabase.from("surgeries").select("*", { count: "exact", head: true }).eq("hospital_id", hospitalId),
      supabase.from("surgeries").select("*", { count: "exact", head: true })
        .eq("hospital_id", hospitalId).eq("status", "scheduled")
        .gte("scheduled_start", startOfDay).lte("scheduled_start", endOfDay),
      supabase.from("surgeries").select("*", { count: "exact", head: true })
        .eq("hospital_id", hospitalId).eq("priority", "emergency")
        .in("status", ["pending", "approved", "scheduled", "in_progress"]),
      supabase.from("surgeries").select("*", { count: "exact", head: true })
        .eq("hospital_id", hospitalId).eq("status", "completed")
        .gte("actual_end", startOfDay),
      supabase.from("surgeries").select("*", { count: "exact", head: true })
        .eq("hospital_id", hospitalId).eq("approval_status", "pending"),
      supabase.from("equipment").select("*", { count: "exact", head: true })
        .eq("hospital_id", hospitalId).in("status", ["maintenance", "sterilizing"]),
      supabase.from("operating_rooms").select("*", { count: "exact", head: true }).eq("hospital_id", hospitalId),
      supabase.from("operating_rooms").select("*", { count: "exact", head: true })
        .eq("hospital_id", hospitalId).eq("status", "occupied"),
    ]);

  const totalORs = orRes.count ?? 1;
  const occupiedORs = occupiedRes.count ?? 0;

  return {
    totalSurgeries: totalRes.count ?? 0,
    scheduledToday: todayRes.count ?? 0,
    emergencyCases: emergencyRes.count ?? 0,
    orUtilization: Math.round((occupiedORs / totalORs) * 100),
    avgWaitTime: 0, // computed from priority_queue
    completedToday: completedRes.count ?? 0,
    pendingApprovals: pendingRes.count ?? 0,
    equipmentAlerts: equipAlertRes.count ?? 0,
  };
}
