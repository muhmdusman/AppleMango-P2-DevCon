/* ============================================================
   Shared TypeScript types for Hospital OR Scheduler
   ============================================================ */

export type Priority = "emergency" | "urgent" | "elective";
export type SurgeryStatus = "pending" | "approved" | "scheduled" | "in_progress" | "completed" | "cancelled" | "rescheduled";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type ORType = "general" | "cardiac" | "neuro" | "orthopedic" | "ent" | "ophthalmic";
export type ORStatus = "available" | "occupied" | "maintenance" | "blocked";
export type EquipmentStatus = "available" | "in_use" | "sterilizing" | "maintenance" | "retired";
export type StaffRole = "surgeon" | "anesthesiologist" | "nurse" | "or_manager" | "scheduler";
export type NotificationType = "info" | "warning" | "error" | "success" | "emergency";
export type SlotType = "setup" | "surgery" | "cleanup";

export interface Hospital {
  id: string;
  name: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  created_at: string;
  updated_at: string;
}

export interface OperatingRoom {
  id: string;
  hospital_id: string;
  name: string;
  room_type: ORType;
  status: ORStatus;
  capabilities: string[];
  created_at: string;
}

export interface Staff {
  id: string;
  hospital_id: string;
  user_id?: string;
  full_name: string;
  role: StaffRole;
  specialization?: string;
  phone?: string;
  email?: string;
  max_hours_per_day: number;
  is_available: boolean;
  created_at: string;
}

export interface Equipment {
  id: string;
  hospital_id: string;
  name: string;
  equipment_type: string;
  status: EquipmentStatus;
  location?: string;
  sterilization_due?: string;
  last_sterilized?: string;
  usage_count: number;
  max_usage_before_maintenance: number;
  next_maintenance?: string;
  notes?: string;
  created_at: string;
}

export interface Surgery {
  id: string;
  hospital_id: string;
  or_id?: string;
  surgeon_id?: string;
  anesthesiologist_id?: string;
  patient_name: string;
  patient_age?: number;
  patient_gender?: string;
  patient_bmi?: number;
  patient_asa_score?: number;
  patient_comorbidities: string[];
  procedure_name: string;
  procedure_type?: string;
  complexity: number;
  priority: Priority;
  specialization_required?: string;
  estimated_duration: number;
  predicted_duration?: number;
  actual_duration?: number;
  scheduled_start?: string;
  scheduled_end?: string;
  actual_start?: string;
  actual_end?: string;
  anesthesia_type: string;
  pre_op_requirements?: string;
  post_op_requirements?: string;
  equipment_requirements: string[];
  status: SurgeryStatus;
  approval_status: ApprovalStatus;
  conflict_notes?: string;
  delay_reason?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  operating_room?: OperatingRoom;
  surgeon?: Staff;
}

export interface ScheduleSlot {
  id: string;
  surgery_id: string;
  or_id: string;
  start_time: string;
  end_time: string;
  slot_type: SlotType;
  created_at: string;
  surgery?: Surgery;
  operating_room?: OperatingRoom;
}

export interface PriorityQueueItem {
  id: string;
  surgery_id: string;
  priority_level: Priority;
  priority_score: number;
  wait_time_hours: number;
  escalated: boolean;
  escalation_time?: string;
  position: number;
  created_at: string;
  updated_at: string;
  surgery?: Surgery;
}

export interface Notification {
  id: string;
  hospital_id: string;
  user_id?: string;
  title: string;
  message: string;
  type: NotificationType;
  category: string;
  is_read: boolean;
  action_url?: string;
  created_at: string;
}

/* Dashboard stats shape */
export interface DashboardStats {
  totalSurgeries: number;
  scheduledToday: number;
  emergencyCases: number;
  orUtilization: number;
  avgWaitTime: number;
  completedToday: number;
  pendingApprovals: number;
  equipmentAlerts: number;
}
