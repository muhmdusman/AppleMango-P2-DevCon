import { NextResponse } from "next/server"
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  type VerifiedRegistrationResponse,
} from "@simplewebauthn/server"
import { createClient } from "@/lib/supabase/server"

const rpName = process.env.WEBAUTHN_RP_NAME || "MedScheduler"
const rpID = process.env.WEBAUTHN_RP_ID || "localhost"
const origin = process.env.WEBAUTHN_ORIGIN || "http://localhost:3000"

// Generate registration options
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  // Get existing credentials for this user
  const { data: existingCreds } = await supabase
    .from("webauthn_credentials")
    .select("credential_id")
    .eq("user_id", user.id)

  const excludeCredentials = (existingCreds || []).map((cred) => ({
    id: cred.credential_id,
    type: "public-key" as const,
  }))

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.email || user.id,
    userDisplayName: user.user_metadata?.full_name || user.email || "User",
    attestationType: "none",
    excludeCredentials,
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
      authenticatorAttachment: "platform",
    },
  })

  // Store challenge in DB for verification
  await supabase.from("webauthn_challenges").upsert({
    user_id: user.id,
    challenge: options.challenge,
    type: "registration",
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  })

  return NextResponse.json(options)
}

// Verify registration response
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = await request.json()

  // Get stored challenge
  const { data: challengeData } = await supabase
    .from("webauthn_challenges")
    .select("challenge")
    .eq("user_id", user.id)
    .eq("type", "registration")
    .single()

  if (!challengeData) {
    return NextResponse.json(
      { error: "Challenge not found or expired" },
      { status: 400 }
    )
  }

  let verification: VerifiedRegistrationResponse
  try {
    verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json(
      { error: "Registration verification failed" },
      { status: 400 }
    )
  }

  const { credential, credentialDeviceType, credentialBackedUp } =
    verification.registrationInfo

  // Store credential
  await supabase.from("webauthn_credentials").insert({
    user_id: user.id,
    credential_id: Buffer.from(credential.id).toString("base64url"),
    public_key: Buffer.from(credential.publicKey).toString("base64"),
    counter: credential.counter,
    device_type: credentialDeviceType,
    backed_up: credentialBackedUp,
    transports: body.response?.transports || [],
  })

  // Clean up challenge
  await supabase
    .from("webauthn_challenges")
    .delete()
    .eq("user_id", user.id)
    .eq("type", "registration")

  // Log in audit trail
  await supabase.from("auth_audit_log").insert({
    user_id: user.id,
    action: "webauthn_register",
    method: "webauthn",
    metadata: { device_type: credentialDeviceType },
  })

  return NextResponse.json({ verified: true })
}
