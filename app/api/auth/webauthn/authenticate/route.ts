import { NextResponse } from "next/server"
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedAuthenticationResponse,
} from "@simplewebauthn/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const rpID = process.env.WEBAUTHN_RP_ID || "localhost"
const origin = process.env.WEBAUTHN_ORIGIN || "http://localhost:3000"

// Generate authentication options
export async function POST(request: Request) {
  const supabase = await createClient()
  const { email } = await request.json()

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 })
  }

  // Look up user by email using admin client (profiles may not be accessible to anon)
  const adminSupabase = createAdminClient()
  const { data: users } = await adminSupabase.auth.admin.listUsers()
  const authUser = users?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  )

  if (!authUser) {
    return NextResponse.json(
      { error: "No account found with this email" },
      { status: 404 }
    )
  }

  // Get credentials for this user
  const { data: credentials } = await supabase
    .from("webauthn_credentials")
    .select("credential_id, transports")
    .eq("user_id", authUser.id)

  if (!credentials || credentials.length === 0) {
    return NextResponse.json(
      { error: "No biometric credentials registered for this account" },
      { status: 404 }
    )
  }

  const allowCredentials = credentials.map((cred) => ({
    id: cred.credential_id,
    type: "public-key" as const,
    transports: cred.transports || [],
  }))

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: "preferred",
  })

  // Store challenge
  await supabase.from("webauthn_challenges").upsert({
    user_id: authUser.id,
    challenge: options.challenge,
    type: "authentication",
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  })

  return NextResponse.json({ options, userId: authUser.id })
}

// Verify authentication response and create a real Supabase session
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { credential, userId } = await request.json()

  if (!credential || !userId) {
    return NextResponse.json(
      { error: "Missing credential or userId" },
      { status: 400 }
    )
  }

  // Get stored challenge
  const { data: challengeData } = await supabase
    .from("webauthn_challenges")
    .select("challenge")
    .eq("user_id", userId)
    .eq("type", "authentication")
    .single()

  if (!challengeData) {
    return NextResponse.json(
      { error: "Challenge not found or expired" },
      { status: 400 }
    )
  }

  // Get the credential from DB
  const credentialId =
    typeof credential.id === "string"
      ? credential.id
      : Buffer.from(credential.id).toString("base64url")

  const { data: storedCred } = await supabase
    .from("webauthn_credentials")
    .select("*")
    .eq("user_id", userId)
    .eq("credential_id", credentialId)
    .single()

  if (!storedCred) {
    return NextResponse.json(
      { error: "Credential not found" },
      { status: 404 }
    )
  }

  let verification: VerifiedAuthenticationResponse
  try {
    verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: storedCred.credential_id,
        publicKey: new Uint8Array(
          Buffer.from(storedCred.public_key, "base64")
        ),
        counter: storedCred.counter,
        transports: storedCred.transports,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  if (!verification.verified) {
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 400 }
    )
  }

  // Update counter
  await supabase
    .from("webauthn_credentials")
    .update({ counter: verification.authenticationInfo.newCounter })
    .eq("credential_id", credentialId)
    .eq("user_id", userId)

  // Clean up challenge
  await supabase
    .from("webauthn_challenges")
    .delete()
    .eq("user_id", userId)
    .eq("type", "authentication")

  // ── Create a real Supabase session using admin magic link ──
  const adminSupabase = createAdminClient()

  // Get user email
  const { data: authUser } = await adminSupabase.auth.admin.getUserById(userId)
  if (!authUser?.user?.email) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  // Generate a magic link and extract the token
  const { data: linkData, error: linkError } =
    await adminSupabase.auth.admin.generateLink({
      type: "magiclink",
      email: authUser.user.email,
    })

  if (linkError || !linkData) {
    return NextResponse.json(
      { error: linkError?.message ?? "Failed to create session" },
      { status: 500 }
    )
  }

  // Log in audit trail
  await supabase.from("auth_audit_log").insert({
    user_id: userId,
    action: "sign_in",
    method: "webauthn",
  })

  // Return the hashed token so the client can exchange it for a session
  return NextResponse.json({
    verified: true,
    token_hash: linkData.properties.hashed_token,
    email: authUser.user.email,
    userId,
  })
}
