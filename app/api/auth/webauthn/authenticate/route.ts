import { NextResponse } from "next/server"
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedAuthenticationResponse,
} from "@simplewebauthn/server"
import { createClient } from "@/lib/supabase/server"

const rpID = process.env.WEBAUTHN_RP_ID || "localhost"
const origin = process.env.WEBAUTHN_ORIGIN || "http://localhost:3000"

// Generate authentication options
export async function POST(request: Request) {
  const supabase = await createClient()
  const { email } = await request.json()

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 })
  }

  // Look up user by email from profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single()

  if (!profile) {
    return NextResponse.json(
      { error: "No account found with this email" },
      { status: 404 }
    )
  }

  // Get credentials for this user
  const { data: credentials } = await supabase
    .from("webauthn_credentials")
    .select("credential_id, transports")
    .eq("user_id", profile.id)

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
    user_id: profile.id,
    challenge: options.challenge,
    type: "authentication",
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  })

  return NextResponse.json({ options, userId: profile.id })
}

// Verify authentication response
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

  // Get user email for sign in
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .single()

  // Log in audit trail
  await supabase.from("auth_audit_log").insert({
    user_id: userId,
    action: "sign_in",
    method: "webauthn",
  })

  return NextResponse.json({
    verified: true,
    email: profile?.email,
    userId,
  })
}
