"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function signInWithPassword(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const role = formData.get("role") as string

  if (!email || !password) {
    return { error: "Email and password are required." }
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  // Verify role matches user metadata
  const userRole = data.user?.user_metadata?.role
  if (userRole && userRole !== role) {
    return { error: `Your account role is "${userRole}", not "${role}".` }
  }

  // Log auth attempt for audit trail
  await supabase.from("auth_audit_log").insert({
    user_id: data.user?.id,
    action: "sign_in",
    method: "password",
    ip_address: null,
    metadata: { role },
  })

  redirect("/dashboard")
}

export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const fullName = formData.get("fullName") as string
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const confirmPassword = formData.get("confirmPassword") as string
  const role = formData.get("role") as string
  const hospital = formData.get("hospital") as string

  if (!fullName || !email || !password || !role || !hospital) {
    return { error: "All fields are required." }
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." }
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role,
        hospital,
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  // Create user profile
  if (data.user) {
    await supabase.from("profiles").upsert({
      id: data.user.id,
      full_name: fullName,
      email,
      role,
      hospital,
    })

    // Log auth attempt
    await supabase.from("auth_audit_log").insert({
      user_id: data.user.id,
      action: "sign_up",
      method: "password",
      metadata: { role, hospital },
    })
  }

  redirect("/dashboard")
}

export async function signOut() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    await supabase.from("auth_audit_log").insert({
      user_id: user.id,
      action: "sign_out",
      method: "session",
    })
  }

  await supabase.auth.signOut()
  redirect("/login")
}
