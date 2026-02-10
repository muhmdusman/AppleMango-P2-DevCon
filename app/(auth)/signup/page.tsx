import type { Metadata } from "next"
import SignupForm from "./signup-form"

export const metadata: Metadata = {
  title: "Sign Up — MedScheduler",
  description: "Create an account for the Hospital Operating Room Scheduling System",
}

export default function SignupPage() {
  return <SignupForm />
}
