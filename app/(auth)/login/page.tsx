import type { Metadata } from "next"
import LoginForm from "./login-form"

export const metadata: Metadata = {
  title: "Sign In — MedScheduler",
  description: "Sign in to the Hospital Operating Room Scheduling System",
}

export default function LoginPage() {
  return <LoginForm />
}
