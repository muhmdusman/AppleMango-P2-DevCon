import { updateSession } from "@/lib/supabase/middleware"
import { type NextRequest, NextResponse } from "next/server"

export async function middleware(request: NextRequest) {
  // 🔓 DEV MODE: Skip auth completely
  // Comment this out to re-enable authentication
  return NextResponse.next()
  
  // 🔐 PRODUCTION: Uncomment the line below to enable auth
  // return await updateSession(request)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth/webauthn|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
