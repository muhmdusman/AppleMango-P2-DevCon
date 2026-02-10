import type { ReactNode } from "react"

export const metadata = {
  title: "MedScheduler — Authentication",
  description: "Sign in to MedScheduler",
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#f4f7fb] to-white px-4 py-12">
      {children}
    </div>
  )
}
