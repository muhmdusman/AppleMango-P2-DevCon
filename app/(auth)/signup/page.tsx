import type { Metadata } from "next"
import SignupForm from "./signup-form"

export const metadata: Metadata = {
  title: "Sign Up — MedScheduler",
  description: "Create your MedScheduler account",
}

export default function SignupPage() {
  return <SignupForm />
}
