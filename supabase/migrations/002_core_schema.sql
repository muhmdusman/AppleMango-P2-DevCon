-- ============================================================
-- Core schema for Hospital OR Scheduler
-- Tables: hospitals, operating_rooms, staff, equipment,
--         surgeries, surgery_equipment, schedule_slots,
--         notifications, priority_queue
-- ============================================================

-- Hospitals / Facilities (multi-tenant)
CREATE TABLE IF NOT EXISTS public.hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Operating Rooms
CREATE TABLE IF NOT EXISTS public.operating_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  room_type TEXT NOT NULL CHECK (room_type IN ('general','cardiac','neuro','orthopedic','ent','ophthalmic')),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','occupied','maintenance','blocked')),
  capabilities TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Staff members (surgeons, anesthesiologists, nurses)
CREATE TABLE IF NOT EXISTS public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('surgeon','anesthesiologist','nurse','or_manager','scheduler')),
  specialization TEXT,
  phone TEXT,
  email TEXT,
  max_hours_per_day INT DEFAULT 12,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Equipment inventory
CREATE TABLE IF NOT EXISTS public.equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  equipment_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','in_use','sterilizing','maintenance','retired')),
  location TEXT,
  sterilization_due TIMESTAMPTZ,
  last_sterilized TIMESTAMPTZ,
  usage_count INT DEFAULT 0,
  max_usage_before_maintenance INT DEFAULT 100,
  next_maintenance TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Surgery requests
CREATE TABLE IF NOT EXISTS public.surgeries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  or_id UUID REFERENCES public.operating_rooms(id),
  surgeon_id UUID REFERENCES public.staff(id),
  anesthesiologist_id UUID REFERENCES public.staff(id),

  -- Patient info
  patient_name TEXT NOT NULL,
  patient_age INT,
  patient_gender TEXT,
  patient_bmi NUMERIC,
  patient_asa_score INT CHECK (patient_asa_score BETWEEN 1 AND 6),
  patient_comorbidities TEXT[] DEFAULT '{}',

  -- Procedure info
  procedure_name TEXT NOT NULL,
  procedure_type TEXT,
  complexity INT NOT NULL DEFAULT 3 CHECK (complexity BETWEEN 1 AND 5),
  priority TEXT NOT NULL DEFAULT 'elective' CHECK (priority IN ('emergency','urgent','elective')),
  specialization_required TEXT,

  -- Timing
  estimated_duration INT NOT NULL DEFAULT 60, -- minutes
  predicted_duration INT,                      -- AI predicted
  actual_duration INT,
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,

  -- Requirements
  anesthesia_type TEXT DEFAULT 'general',
  pre_op_requirements TEXT,
  post_op_requirements TEXT,
  equipment_requirements TEXT[] DEFAULT '{}',

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','scheduled','in_progress','completed','cancelled','rescheduled')),
  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected')),
  conflict_notes TEXT,
  delay_reason TEXT,

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Surgery-equipment junction
CREATE TABLE IF NOT EXISTS public.surgery_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgery_id UUID NOT NULL REFERENCES public.surgeries(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  UNIQUE(surgery_id, equipment_id)
);

-- Schedule slots (Gantt chart backing)
CREATE TABLE IF NOT EXISTS public.schedule_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgery_id UUID NOT NULL REFERENCES public.surgeries(id) ON DELETE CASCADE,
  or_id UUID NOT NULL REFERENCES public.operating_rooms(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  slot_type TEXT NOT NULL DEFAULT 'surgery' CHECK (slot_type IN ('setup','surgery','cleanup')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Priority queue
CREATE TABLE IF NOT EXISTS public.priority_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgery_id UUID NOT NULL REFERENCES public.surgeries(id) ON DELETE CASCADE,
  priority_level TEXT NOT NULL CHECK (priority_level IN ('emergency','urgent','elective')),
  priority_score NUMERIC DEFAULT 0,
  wait_time_hours NUMERIC DEFAULT 0,
  escalated BOOLEAN DEFAULT false,
  escalation_time TIMESTAMPTZ,
  position INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info','warning','error','success','emergency')),
  category TEXT DEFAULT 'general' CHECK (category IN ('general','schedule','equipment','emergency','staff','system')),
  is_read BOOLEAN DEFAULT false,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_surgeries_hospital ON public.surgeries(hospital_id);
CREATE INDEX IF NOT EXISTS idx_surgeries_status ON public.surgeries(status);
CREATE INDEX IF NOT EXISTS idx_surgeries_priority ON public.surgeries(priority);
CREATE INDEX IF NOT EXISTS idx_surgeries_scheduled ON public.surgeries(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_surgeries_surgeon ON public.surgeries(surgeon_id);
CREATE INDEX IF NOT EXISTS idx_equipment_hospital ON public.equipment(hospital_id);
CREATE INDEX IF NOT EXISTS idx_equipment_status ON public.equipment(status);
CREATE INDEX IF NOT EXISTS idx_staff_hospital ON public.staff(hospital_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_slots_or ON public.schedule_slots(or_id);
CREATE INDEX IF NOT EXISTS idx_schedule_slots_time ON public.schedule_slots(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_or_hospital ON public.operating_rooms(hospital_id);

-- Enable RLS on all tables
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operating_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surgeries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surgery_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.priority_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies: allow authenticated users (simplified for hackathon)
CREATE POLICY "Authenticated read hospitals" ON public.hospitals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage hospitals" ON public.hospitals FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read ORs" ON public.operating_rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage ORs" ON public.operating_rooms FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read staff" ON public.staff FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage staff" ON public.staff FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read equipment" ON public.equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage equipment" ON public.equipment FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read surgeries" ON public.surgeries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage surgeries" ON public.surgeries FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read surgery_equipment" ON public.surgery_equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage surgery_equipment" ON public.surgery_equipment FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read schedule_slots" ON public.schedule_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage schedule_slots" ON public.schedule_slots FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read priority_queue" ON public.priority_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage priority_queue" ON public.priority_queue FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read notifications" ON public.notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage notifications" ON public.notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);
