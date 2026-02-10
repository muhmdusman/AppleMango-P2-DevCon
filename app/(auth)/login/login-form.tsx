"use client"

import { useState, useTransition, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Fingerprint } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { startAuthentication } from "@simplewebauthn/browser"

const ROLES = [
  { value: "admin", label: "Hospital Admin" },
  { value: "manager", label: "OR Manager" },
  { value: "surgeon", label: "Surgeon" },
  { value: "scheduler", label: "Scheduler" },
  { value: "nurse", label: "Nurse" },
] as const

export default function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("admin")
  const [isPending, startTransition] = useTransition()
  const [biometricLoading, setBiometricLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")

    startTransition(async () => {
      try {
        const supabase = createClient()
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (authError) {
          setError(authError.message)
          return
        }

        // Verify role matches
        const userRole = data.user?.user_metadata?.role
        if (userRole && userRole !== role) {
          setError(`Your account role is "${userRole}", not "${role}".`)
          await supabase.auth.signOut()
          return
        }

        router.push("/dashboard")
        router.refresh()
      } catch {
        setError("Invalid credentials. Please try again.")
      }
    })
  }

  async function handleBiometric() {
    setError("")

    if (!email) {
      setError("Please enter your email first for biometric login.")
      return
    }

    setBiometricLoading(true)

    try {
      if (!window.PublicKeyCredential) {
        setError("Biometric authentication is not supported on this device.")
        return
      }

      // Step 1: Get authentication options from server
      const optionsRes = await fetch("/api/auth/webauthn/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      if (!optionsRes.ok) {
        const errData = await optionsRes.json()
        setError(errData.error || "Failed to start biometric authentication.")
        return
      }

      const { options, userId } = await optionsRes.json()

      // Step 2: Trigger biometric prompt
      const credential = await startAuthentication({ optionsJSON: options })

      // Step 3: Verify with server
      const verifyRes = await fetch("/api/auth/webauthn/authenticate", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential, userId }),
      })

      if (!verifyRes.ok) {
        const errData = await verifyRes.json()
        setError(errData.error || "Biometric verification failed.")
        return
      }

      // Step 4: Sign in with Supabase using the verified identity
      // For WebAuthn, we sign in via a special token or password-less flow
      // Since Supabase doesn't natively support WebAuthn, we use a workaround:
      // The server has verified the identity, so we redirect
      router.push("/dashboard")
      router.refresh()
    } catch {
      setError("Biometric authentication failed. Please try password login.")
    } finally {
      setBiometricLoading(false)
    }
  }

  return (
    <div className="w-full max-w-[400px] rounded-[40px] border-[5px] border-white bg-gradient-to-b from-white to-[#f4f7fb] p-8 shadow-[rgba(133,189,215,0.88)_0px_30px_30px_-20px]">
      {/* Header */}
      <div className="mb-2 text-center">
        <h1 className="text-3xl font-black text-[#1089d3]">Sign In</h1>
        <p className="mt-1 text-sm text-[#aaa]">Hospital OR Scheduling System</p>
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

        <div className="ml-2">
          <Link
            href="#"
            className="text-xs text-[#0099ff] hover:underline"
          >
            Forgot Password?
          </Link>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-[20px] bg-gradient-to-r from-[#1089d3] to-[#12b1d1] py-4 font-bold text-white shadow-[rgba(133,189,215,0.88)_0px_20px_10px_-15px] transition-all hover:scale-[1.03] hover:shadow-[rgba(133,189,215,0.88)_0px_23px_10px_-20px] active:scale-95 active:shadow-[rgba(133,189,215,0.88)_0px_15px_10px_-10px] disabled:opacity-60 disabled:hover:scale-100"
        >
          {isPending ? "Signing in..." : "Sign In"}
        </button>
      </form>

      {/* Biometric Separator */}
      <div className="mt-6">
        <span className="block text-center text-xs text-[#aaa]">
          Or sign in with biometrics
        </span>
        <p className="mt-1 text-center text-[10px] text-[#ccc]">
          Register during sign up or in settings
        </p>

        {/* Biometric Button */}
        <button
          type="button"
          onClick={handleBiometric}
          disabled={biometricLoading || !email}
          className="mx-auto mt-3 flex items-center justify-center gap-2 rounded-[20px] bg-gradient-to-r from-[#1089d3] to-[#12b1d1] px-6 py-3 text-sm font-semibold text-white shadow-[rgba(133,189,215,0.88)_0px_12px_10px_-8px] transition-all hover:scale-[1.03] active:scale-95 disabled:opacity-60"
        >
          <Fingerprint className="h-5 w-5" />
          {biometricLoading ? "Authenticating..." : "Fingerprint / Face ID"}
        </button>
        {!email && (
          <p className="mt-2 text-center text-[10px] text-orange-400">
            Enter your email above to use biometric login
          </p>
        )}
      </div>

      {/* Footer */}
      <p className="mt-6 text-center text-sm text-[#aaa]">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-semibold text-[#0099ff] hover:underline"
        >
          Sign Up
        </Link>
      </p>
    </div>
  )
}
