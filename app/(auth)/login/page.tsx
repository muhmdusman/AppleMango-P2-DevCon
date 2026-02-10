import type { Metadata } from "next"
import LoginForm from "./login-form"

export const metadata: Metadata = {
  title: "Sign In — MedScheduler",
  description: "Sign in to MedScheduler",
}

export default function LoginPage() {
  return <LoginForm />
}
