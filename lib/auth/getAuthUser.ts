/**
 * Authentication helper for server-side actions
 * Handles dev mode auth bypass
 */
"use server"

import { createClient } from "@/lib/supabase/server"
import { DEV_USER, shouldBypassAuth } from "./devUser"

/**
 * Get the current authenticated user
 * In dev mode with bypass enabled, returns the fake dev user
 * Otherwise returns the real Supabase user
 */
export async function getAuthUser() {
  // 🔓 DEV BYPASS - Return fake user
  if (shouldBypassAuth()) {
    return {
      user: {
        id: DEV_USER.id,
        email: DEV_USER.email,
        user_metadata: DEV_USER.user_metadata,
        aud: DEV_USER.aud,
        created_at: DEV_USER.created_at,
        updated_at: DEV_USER.updated_at,
        app_metadata: {},
        role: DEV_USER.role,
      },
      error: null,
    }
  }

  // 🔐 REAL AUTH - Get actual user from Supabase
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  return { user, error }
}
