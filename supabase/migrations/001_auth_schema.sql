-- ============================================
-- MedScheduler Auth Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'surgeon', 'scheduler', 'nurse')),
  hospital TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 2. WebAuthn credentials table
CREATE TABLE IF NOT EXISTS public.webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  device_type TEXT,
  backed_up BOOLEAN DEFAULT FALSE,
  transports TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, credential_id)
);

ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credentials"
  ON public.webauthn_credentials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credentials"
  ON public.webauthn_credentials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credentials"
  ON public.webauthn_credentials FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own credentials"
  ON public.webauthn_credentials FOR DELETE
  USING (auth.uid() = user_id);

-- 3. WebAuthn challenges (temporary, for verification)
CREATE TABLE IF NOT EXISTS public.webauthn_challenges (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('registration', 'authentication')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own challenges"
  ON public.webauthn_challenges FOR ALL
  USING (auth.uid() = user_id);

-- 4. Auth audit log
CREATE TABLE IF NOT EXISTS public.auth_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  method TEXT NOT NULL,
  ip_address INET,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit log"
  ON public.auth_audit_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own audit log"
  ON public.auth_audit_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 5. Auto-create profile on signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, hospital)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'scheduler'),
    COALESCE(NEW.raw_user_meta_data->>'hospital', 'Default Hospital')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_hospital ON public.profiles(hospital);
CREATE INDEX IF NOT EXISTS idx_webauthn_creds_user ON public.webauthn_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.auth_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.auth_audit_log(created_at DESC);

-- 7. Allow anon to read profiles by email (for WebAuthn lookup)
CREATE POLICY "Anon can lookup profile by email"
  ON public.profiles FOR SELECT
  USING (true);
