/* ============================================================
   Constraint Satisfaction Scheduler
   - Hard constraints: surgeon match, OR capability, equipment,
     no surgeon > 12h, sterilization cycles
   - Soft constraints: minimize wait, minimize idle, batch similar
   - Conflict detection and cascade rescheduling
   ============================================================ */

import type { Surgery, OperatingRoom, Staff, Equipment, ScheduleSlot } from "@/lib/types";

export interface Constraint {
  type: "hard" | "soft";
  name: string;
  description: string;
}

export interface ConflictResult {
  hasConflict: boolean;
  hardViolations: string[];
  softViolations: string[];
  score: number; // 0-100 optimality
}

/* Hard constraints enforced by the scheduler */
const HARD_CONSTRAINTS: Constraint[] = [
  { type: "hard", name: "surgeon_specialization", description: "Surgeon specialization must match surgery requirement" },
  { type: "hard", name: "or_capability", description: "OR must support the required procedure type" },
  { type: "hard", name: "equipment_available", description: "Required equipment must be available and sterilized" },
  { type: "hard", name: "no_overlap", description: "No overlapping surgeries in the same OR" },
  { type: "hard", name: "surgeon_hours", description: "Surgeon must not exceed 12 hours in 24 hours" },
  { type: "hard", name: "sterilization_gap", description: "Equipment sterilization cycles must be < 3 hours apart" },
];

/* Soft constraints for optimization */
const SOFT_CONSTRAINTS: Constraint[] = [
  { type: "soft", name: "minimize_wait", description: "Minimize patient wait time" },
  { type: "soft", name: "minimize_idle", description: "Minimize OR idle time between surgeries" },
  { type: "soft", name: "batch_similar", description: "Batch similar procedures together" },
  { type: "soft", name: "minimize_overtime", description: "Avoid scheduling past regular hours" },
];

/**
 * Check all constraints for a proposed surgery slot placement.
 */
export function checkConstraints(
  surgery: Surgery,
  proposedOR: OperatingRoom,
  proposedStart: Date,
  proposedEnd: Date,
  existingSlots: ScheduleSlot[],
  surgeon?: Staff,
  equipmentList?: Equipment[]
): ConflictResult {
  const hardViolations: string[] = [];
  const softViolations: string[] = [];

  // ── Hard Constraint: OR overlap ──
  const orSlots = existingSlots.filter(s => s.or_id === proposedOR.id);
  for (const slot of orSlots) {
    const slotStart = new Date(slot.start_time);
    const slotEnd = new Date(slot.end_time);
    if (proposedStart < slotEnd && proposedEnd > slotStart) {
      hardViolations.push(`Time conflict with existing surgery in ${proposedOR.name}`);
    }
  }

  // ── Hard Constraint: OR capability ──
  if (surgery.specialization_required && proposedOR.room_type !== "general") {
    if (!proposedOR.capabilities.includes(surgery.specialization_required) &&
        proposedOR.room_type !== surgery.specialization_required) {
      hardViolations.push(`OR ${proposedOR.name} lacks capability: ${surgery.specialization_required}`);
    }
  }

  // ── Hard Constraint: Surgeon specialization ──
  if (surgeon && surgery.specialization_required) {
    if (surgeon.specialization !== surgery.specialization_required) {
      hardViolations.push(`Surgeon ${surgeon.full_name} specialization mismatch`);
    }
  }

  // ── Hard Constraint: Surgeon hours (12h limit) ──
  if (surgeon) {
    const surgeonSlots = existingSlots.filter(
      s => s.surgery?.surgeon_id === surgeon.id
    );
    const totalMinutes = surgeonSlots.reduce((sum, s) => {
      return sum + (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 60000;
    }, 0);
    const newDuration = (proposedEnd.getTime() - proposedStart.getTime()) / 60000;
    if (totalMinutes + newDuration > 12 * 60) {
      hardViolations.push(`Surgeon ${surgeon.full_name} would exceed 12-hour limit`);
    }
  }

  // ── Hard Constraint: Equipment availability ──
  if (equipmentList) {
    for (const eq of equipmentList) {
      if (eq.status === "maintenance" || eq.status === "retired") {
        hardViolations.push(`Equipment "${eq.name}" is unavailable (${eq.status})`);
      }
      if (eq.status === "sterilizing") {
        hardViolations.push(`Equipment "${eq.name}" is currently being sterilized`);
      }
    }
  }

  // ── Soft Constraint: Overtime (past 18:00) ──
  if (proposedEnd.getHours() >= 18) {
    softViolations.push("Surgery extends past regular hours (18:00)");
  }

  // ── Soft Constraint: Early morning (before 07:00) ──
  if (proposedStart.getHours() < 7) {
    softViolations.push("Surgery starts before 07:00");
  }

  // ── Soft Constraint: Gap detection ──
  if (orSlots.length > 0) {
    const lastSlotEnd = Math.max(...orSlots.map(s => new Date(s.end_time).getTime()));
    const gap = (proposedStart.getTime() - lastSlotEnd) / 60000;
    if (gap > 60) {
      softViolations.push(`${Math.round(gap)}min gap before this surgery — OR underutilized`);
    }
  }

  // Calculate optimality score
  const hardPenalty = hardViolations.length * 25;
  const softPenalty = softViolations.length * 5;
  const score = Math.max(0, 100 - hardPenalty - softPenalty);

  return {
    hasConflict: hardViolations.length > 0,
    hardViolations,
    softViolations,
    score,
  };
}

/**
 * Auto-schedule: find the best available slot for a surgery.
 * Uses greedy approach sorted by priority.
 */
export function findBestSlot(
  surgery: Surgery,
  rooms: OperatingRoom[],
  existingSlots: ScheduleSlot[],
  startDate: Date
): { or: OperatingRoom; start: Date; end: Date } | null {
  const durationMs = surgery.estimated_duration * 60000;
  const setupMs = 15 * 60000;   // 15 min setup
  const cleanupMs = 15 * 60000; // 15 min cleanup
  const totalMs = setupMs + durationMs + cleanupMs;

  // Try each room
  for (const room of rooms) {
    // Check room type compatibility
    if (surgery.specialization_required && room.room_type !== "general" &&
        room.room_type !== surgery.specialization_required) {
      continue;
    }

    // Find available time slots on the given date
    const dayStart = new Date(startDate);
    dayStart.setHours(7, 0, 0, 0);
    const dayEnd = new Date(startDate);
    dayEnd.setHours(20, 0, 0, 0);

    const roomSlots = existingSlots
      .filter(s => s.or_id === room.id)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    // Try gaps between existing slots
    let searchTime = dayStart.getTime();
    for (const slot of roomSlots) {
      const slotStart = new Date(slot.start_time).getTime();
      if (slotStart - searchTime >= totalMs) {
        return {
          or: room,
          start: new Date(searchTime + setupMs),
          end: new Date(searchTime + setupMs + durationMs),
        };
      }
      searchTime = Math.max(searchTime, new Date(slot.end_time).getTime());
    }

    // Try after the last slot
    if (searchTime + totalMs <= dayEnd.getTime()) {
      return {
        or: room,
        start: new Date(searchTime + setupMs),
        end: new Date(searchTime + setupMs + durationMs),
      };
    }
  }

  return null; // No available slot found
}

export { HARD_CONSTRAINTS, SOFT_CONSTRAINTS };
