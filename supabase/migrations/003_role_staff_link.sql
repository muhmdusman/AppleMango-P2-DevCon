
-- Migration 003: Link user profiles to staff + role-based views
-- Auto-creates a staff record when a user signs up as surgeon/nurse/etc.


-- Update handle_new_user to also create a staff link
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_hospital_id UUID;
  v_role TEXT;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, full_name, email, role, hospital)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'scheduler'),
    COALESCE(NEW.raw_user_meta_data->>'hospital', 'Default Hospital')
  )
  ON CONFLICT (id) DO NOTHING;

  -- Get first hospital (or null)
  SELECT id INTO v_hospital_id FROM public.hospitals LIMIT 1;

  -- Create staff record if hospital exists and role is a staff role
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'scheduler');
  IF v_hospital_id IS NOT NULL AND v_role IN ('surgeon', 'nurse', 'manager', 'scheduler', 'admin') THEN
    INSERT INTO public.staff (hospital_id, user_id, full_name, role, specialization, email)
    VALUES (
      v_hospital_id,
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      CASE v_role
        WHEN 'admin' THEN 'or_manager'
        WHEN 'manager' THEN 'or_manager'
        ELSE v_role
      END,
      CASE v_role
        WHEN 'surgeon' THEN 'general'
        ELSE NULL
      END,
      NEW.email
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow all authenticated users to read profiles (for role checks)
DROP POLICY IF EXISTS "Anon can lookup profile by email" ON public.profiles;
CREATE POLICY "Authenticated read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);
