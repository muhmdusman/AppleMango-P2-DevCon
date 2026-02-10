"use client"

import { useState, useTransition, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Fingerprint } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { startRegistration } from "@simplewebauthn/browser"

const ROLES = [
  { value: "admin", label: "Hospital Admin" },
  { value: "manager", label: "OR Manager" },
  { value: "surgeon", label: "Surgeon" },
  { value: "scheduler", label: "Scheduler" },
  { value: "nurse", label: "Nurse" },
] as const

export default function SignupForm() {
  const router = useRouter()
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [role, setRole] = useState("admin")
  const [hospital, setHospital] = useState("")
  const [isPending, startTransition] = useTransition()
  const [biometricLoading, setBiometricLoading] = useState(false)
  const [error, setError] = useState("")
  const [signedUp, setSignedUp] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }

    startTransition(async () => {
      try {
        const supabase = createClient()
        const { data, error: authError } = await supabase.auth.signUp({
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

        if (authError) {
          setError(authError.message)
          return
        }

        if (data.user) {
          setSignedUp(true)
          // Don't redirect yet — let user register biometric first
        }
      } catch {
        setError("Registration failed. Please try again.")
      }
    })
  }

  async function handleBiometricRegister() {
    setError("")
    setBiometricLoading(true)

    try {
      if (!window.PublicKeyCredential) {
        setError("Biometric authentication is not supported on this device.")
        return
      }

      // Get registration options from server
      const optionsRes = await fetch("/api/auth/webauthn/register")
      if (!optionsRes.ok) {
        const errData = await optionsRes.json()
        setError(errData.error || "Failed to start biometric registration.")
        return
      }

      const options = await optionsRes.json()

      // Trigger biometric prompt
      const credential = await startRegistration({ optionsJSON: options })

      // Verify with server
      const verifyRes = await fetch("/api/auth/webauthn/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential),
      })

      if (!verifyRes.ok) {
        const errData = await verifyRes.json()
        setError(errData.error || "Biometric registration failed.")
        return
      }

      setError("")
      goToDashboard()
    } catch {
      setError("Biometric registration failed. You can set it up later in settings.")
    } finally {
      setBiometricLoading(false)
    }
  }

  function goToDashboard() {
    router.push("/dashboard")
    router.refresh()
  }

  // After signup: show biometric registration step
  if (signedUp) {
    return (
      <div className="w-full max-w-[400px] rounded-[40px] border-[5px] border-white bg-gradient-to-b from-white to-[#f4f7fb] p-8 shadow-[rgba(133,189,215,0.88)_0px_30px_30px_-20px]">
        <div className="mb-2 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h1 className="text-2xl font-black text-[#1089d3]">Account Created!</h1>
          <p className="mt-2 text-sm text-[#aaa]">Enable biometric login for quick access</p>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-6 space-y-4">
          <button
            type="button"
            onClick={handleBiometricRegister}
            disabled={biometricLoading}
            className="w-full rounded-[20px] bg-gradient-to-r from-[#1089d3] to-[#12b1d1] py-4 font-bold text-white shadow-[rgba(133,189,215,0.88)_0px_20px_10px_-15px] transition-all hover:scale-[1.03] hover:shadow-[rgba(133,189,215,0.88)_0px_23px_10px_-20px] active:scale-95 disabled:opacity-60"
          >
            <span className="flex items-center justify-center gap-2">
              <Fingerprint className="h-5 w-5" />
              {biometricLoading ? "Registering..." : "Register Fingerprint / Face ID"}
            </span>
          </button>

          <button
            type="button"
            onClick={goToDashboard}
            className="w-full rounded-[20px] border-2 border-[#e2e8f0] bg-white py-3 text-sm font-semibold text-[#6b7280] transition-all hover:bg-[#f4f7fb]"
          >
            Skip for now
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-[400px] rounded-[40px] border-[5px] border-white bg-gradient-to-b from-white to-[#f4f7fb] p-8 shadow-[rgba(133,189,215,0.88)_0px_30px_30px_-20px]">
      {/* Header */}
      <div className="mb-2 text-center">
        <h1 className="text-3xl font-black text-[#1089d3]">Sign Up</h1>
        <p className="mt-1 text-sm text-[#aaa]">MedScheduler</p>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <input
          required
          type="text"
          placeholder="Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-[20px] border-2 border-transparent bg-white px-5 py-4 shadow-[#cff0ff_0px_10px_10px_-5px] placeholder:text-[#aaa] focus:border-[#12b1d1] focus:outline-none"
        />

        <input
          required
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-[20px] border-2 border-transparent bg-white px-5 py-4 shadow-[#cff0ff_0px_10px_10px_-5px] placeholder:text-[#aaa] focus:border-[#12b1d1] focus:outline-none"
        />

        <input
          required
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-[20px] border-2 border-transparent bg-white px-5 py-4 shadow-[#cff0ff_0px_10px_10px_-5px] placeholder:text-[#aaa] focus:border-[#12b1d1] focus:outline-none"
        />

        <input
          required
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full rounded-[20px] border-2 border-transparent bg-white px-5 py-4 shadow-[#cff0ff_0px_10px_10px_-5px] placeholder:text-[#aaa] focus:border-[#12b1d1] focus:outline-none"
        />

        {/* Role Selection */}
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full rounded-[20px] border-2 border-transparent bg-white px-5 py-4 text-[#1a1a2e] shadow-[#cff0ff_0px_10px_10px_-5px] focus:border-[#12b1d1] focus:outline-none"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        {/* Hospital / Facility */}
        <input
          required
          type="text"
          placeholder="Hospital / Facility Name"
          value={hospital}
          onChange={(e) => setHospital(e.target.value)}
          className="w-full rounded-[20px] border-2 border-transparent bg-white px-5 py-4 shadow-[#cff0ff_0px_10px_10px_-5px] placeholder:text-[#aaa] focus:border-[#12b1d1] focus:outline-none"
        />

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-[20px] bg-gradient-to-r from-[#1089d3] to-[#12b1d1] py-4 font-bold text-white shadow-[rgba(133,189,215,0.88)_0px_20px_10px_-15px] transition-all hover:scale-[1.03] hover:shadow-[rgba(133,189,215,0.88)_0px_23px_10px_-20px] active:scale-95 active:shadow-[rgba(133,189,215,0.88)_0px_15px_10px_-10px] disabled:opacity-60 disabled:hover:scale-100"
        >
          {isPending ? "Creating Account..." : "Sign Up"}
        </button>
      </form>

      {/* Footer */}
      <p className="mt-6 text-center text-sm text-[#aaa]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-[#0099ff] hover:underline"
        >
          Sign In
        </Link>
      </p>
    </div>
  )
}
