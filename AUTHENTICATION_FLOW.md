# 🔐 Supabase Authentication Flow & Database Setup

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                       USER INTERACTION                           │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION LAYER                          │
│  ┌──────────────┐  ┌─────────────┐  ┌───────────────────────┐  │
│  │  Password    │  │  WebAuthn   │  │  Session Cookies      │  │
│  │  (Email/PW)  │  │  (Biometric)│  │  (JWT in httpOnly)    │  │
│  └──────────────┘  └─────────────┘  └───────────────────────┘  │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MIDDLEWARE LAYER                              │
│  - Validates JWT on every request                               │
│  - Refreshes tokens automatically                               │
│  - Redirects unauthenticated users                              │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                             │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────────┐   │
│  │  auth.users  │  │  profiles   │  │  webauthn_credentials│   │
│  │  (built-in)  │  │  (custom)   │  │  (custom)            │   │
│  └──────────────┘  └─────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Database Schema Setup

### A. Authentication Tables (001_auth_schema.sql)

#### 📋 **profiles** - Extends Supabase's built-in auth.users
```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,  -- 'admin', 'manager', 'surgeon', 'scheduler', 'nurse'
  hospital TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```
- **Purpose**: Store user metadata and role information
- **Trigger**: Auto-created when user signs up via `handle_new_user()` function
- **RLS**: Users can view/update their own profile

#### 🔑 **webauthn_credentials** - Passwordless biometric auth
```sql
CREATE TABLE public.webauthn_credentials (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  credential_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  counter BIGINT,
  device_type TEXT,
  transports TEXT[]
)
```
- **Purpose**: Store Face ID/Touch ID/Windows Hello credentials
- **RLS**: Users can manage only their own credentials

#### 🎫 **webauthn_challenges** - Temporary verification codes
```sql
CREATE TABLE public.webauthn_challenges (
  user_id UUID PRIMARY KEY,
  challenge TEXT NOT NULL,
  type TEXT,  -- 'registration' or 'authentication'
  expires_at TIMESTAMPTZ
)
```
- **Purpose**: Prevent replay attacks in WebAuthn flow
- **Lifetime**: 5 minutes, then expires

#### 📜 **auth_audit_log** - Security audit trail
```sql
CREATE TABLE public.auth_audit_log (
  id UUID PRIMARY KEY,
  user_id UUID,
  action TEXT,  -- 'sign_in', 'sign_up', 'sign_out'
  method TEXT,  -- 'password', 'webauthn'
  ip_address INET,
  metadata JSONB,
  created_at TIMESTAMPTZ
)
```
- **Purpose**: Track all authentication events for security monitoring

### B. Core Application Tables (002_core_schema.sql)

#### 🏥 **hospitals** - Multi-tenant support
- Each hospital is isolated
- Stores hospital metadata

#### 🚪 **operating_rooms** - OR resources
- Links to hospitals
- Tracks room type, status, capabilities

#### 👨‍⚕️ **staff** - Medical personnel
- Links to `auth.users` via `user_id`
- Roles: surgeon, anesthesiologist, nurse, or_manager, scheduler
- Specialization-based filtering

#### 🔪 **surgeries** - Surgery requests
- Patient demographics
- Procedure details
- Status tracking (pending → approved → scheduled → completed)
- Links to surgeon, anesthesiologist, OR

#### ⚙️ **equipment** - Medical equipment inventory
- Status tracking
- Sterilization schedules
- Usage counters

---

## 2. Authentication Flow

### 🔐 Password Authentication

```
┌──────────┐
│  Client  │
│ (Browser)│
└────┬─────┘
     │
     │ 1. User enters email/password/role
     │
     ▼
┌─────────────────────────────────────────┐
│  app/actions/auth.ts                    │
│  signInWithPassword()                   │
│                                         │
│  - Validates input                      │
│  - Calls supabase.auth.signInWithPassword() │
│  - Verifies role matches user_metadata  │
│  - Logs to auth_audit_log              │
└────┬────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│  Supabase Auth API                      │
│                                         │
│  - Validates password                   │
│  - Generates JWT access token           │
│  - Sets httpOnly session cookie         │
│  - Returns user object                  │
└────┬────────────────────────────────────┘
     │
     │ 2. Cookie stored in browser
     │
     ▼
┌─────────────────────────────────────────┐
│  Browser redirects to /dashboard        │
└─────────────────────────────────────────┘
```

**Code Implementation:**
```typescript
// app/actions/auth.ts
export async function signInWithPassword(formData: FormData) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: formData.get("email"),
    password: formData.get("password"),
  })
  
  // Role verification
  const userRole = data.user?.user_metadata?.role
  if (userRole !== formData.get("role")) {
    return { error: "Role mismatch" }
  }
  
  // Audit logging
  await supabase.from("auth_audit_log").insert({
    user_id: data.user?.id,
    action: "sign_in",
    method: "password",
  })
  
  redirect("/dashboard")
}
```

### 👆 WebAuthn Biometric Authentication

```
┌──────────┐
│  Client  │
│ (Browser)│
└────┬─────┘
     │
     │ 1. User clicks "Use Biometric"
     │
     ▼
┌─────────────────────────────────────────┐
│  POST /api/auth/webauthn/authenticate   │
│                                         │
│  - Lookup user by email                 │
│  - Fetch stored credentials             │
│  - Generate authentication challenge    │
│  - Store challenge in DB (5 min expiry) │
└────┬────────────────────────────────────┘
     │
     │ 2. Returns challenge to browser
     │
     ▼
┌─────────────────────────────────────────┐
│  Browser triggers Face ID/Touch ID      │
│  (via Web Authentication API)           │
│                                         │
│  navigator.credentials.get()            │
└────┬────────────────────────────────────┘
     │
     │ 3. User scans face/fingerprint
     │
     ▼
┌─────────────────────────────────────────┐
│  PUT /api/auth/webauthn/authenticate    │
│                                         │
│  - Verify challenge matches             │
│  - Verify signature with public key     │
│  - Update counter (anti-replay)         │
│  - Create Supabase session              │
└────┬────────────────────────────────────┘
     │
     │ 4. Session established
     │
     ▼
┌─────────────────────────────────────────┐
│  Browser redirects to /dashboard        │
└─────────────────────────────────────────┘
```

**Code Implementation:**
```typescript
// app/api/auth/webauthn/authenticate/route.ts
export async function POST(request: Request) {
  const { email } = await request.json()
  
  // Get user credentials
  const { data: credentials } = await supabase
    .from("webauthn_credentials")
    .select("*")
    .eq("user_id", userId)
  
  // Generate challenge
  const options = await generateAuthenticationOptions({
    rpID: "localhost",
    allowCredentials: credentials.map(c => ({
      id: c.credential_id,
      type: "public-key"
    }))
  })
  
  // Store challenge temporarily
  await supabase.from("webauthn_challenges").upsert({
    user_id: userId,
    challenge: options.challenge,
    expires_at: new Date(Date.now() + 5*60*1000)
  })
  
  return NextResponse.json({ options, userId })
}
```

---

## 3. Middleware Protection Layer

### 📋 Request Flow
```
Every HTTP Request
       │
       ▼
┌─────────────────────┐
│  middleware.ts      │
│  (Root level)       │
└─────────┬───────────┘
          │
          ▼
┌──────────────────────────────────────┐
│  lib/supabase/middleware.ts          │
│  updateSession()                     │
│                                      │
│  1. Read session cookie              │
│  2. Validate JWT token               │
│  3. Refresh if needed                │
│  4. Check auth status                │
└──────────┬───────────────────────────┘
           │
           ▼
    ┌──────────┴──────────┐
    │                     │
    ▼                     ▼
┌─────────┐         ┌─────────┐
│  ✅ YES  │         │  ❌ NO   │
│ User    │         │ User    │
│ Logged  │         │ Not     │
│ In      │         │ Logged  │
└────┬────┘         └────┬────┘
     │                   │
     ▼                   ▼
┌─────────┐         ┌─────────┐
│ Allow   │         │ Redirect│
│ Access  │         │ /login  │
└─────────┘         └─────────┘
```

**Code Implementation:**
```typescript
// middleware.ts (Root)
export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

// lib/supabase/middleware.ts
export async function updateSession(request: NextRequest) {
  const supabase = createServerClient(/* ... */)
  
  // Validate session
  const { data: { user } } = await supabase.auth.getUser()
  
  const isAuthPage = request.nextUrl.pathname.startsWith("/login")
  
  // Redirect logic
  if (!user && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }
  
  return response
}
```

---

## 4. Role-Based Access Control (RBAC)

### 🎭 Role Hierarchy

```
┌─────────────────────────────────────────┐
│              ADMIN                      │
│  - Full system access                   │
│  - User management                      │
│  - All CRUD operations                  │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│            MANAGER                      │
│  - OR allocation                        │
│  - Surgery approval                     │
│  - Schedule management                  │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│            SURGEON                      │
│  - Create surgery requests              │
│  - View own schedule                    │
│  - Update surgery status                │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│           SCHEDULER                     │
│  - View surgeries                       │
│  - Schedule operations                  │
│  - Manage equipment                     │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│             NURSE                       │
│  - View schedule                        │
│  - Update equipment status              │
│  - Read-only surgery details            │
└─────────────────────────────────────────┘
```

### 💾 Role Storage & Verification

**During Sign Up:**
```typescript
// app/actions/auth.ts
export async function signUp(formData: FormData) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: role,        // ← Stored in JWT user_metadata
        hospital: hospital
      }
    }
  })
  
  // Also stored in profiles table via trigger
  // Trigger: handle_new_user() in 001_auth_schema.sql
}
```

**During Sign In:**
```typescript
// app/actions/auth.ts
export async function signInWithPassword(formData: FormData) {
  const { data } = await supabase.auth.signInWithPassword({...})
  
  // Verify role matches
  const userRole = data.user?.user_metadata?.role
  const selectedRole = formData.get("role")
  
  if (userRole !== selectedRole) {
    return { error: `Your account role is "${userRole}", not "${selectedRole}"` }
  }
}
```

**In Server Actions:**
```typescript
// app/actions/surgery.ts
export async function approveSurgery(id: string, approved: boolean) {
  const { user } = await getAuthUser()
  
  // Check if user has permission
  const userRole = user?.user_metadata?.role
  if (!['admin', 'manager'].includes(userRole)) {
    return { error: "Insufficient permissions" }
  }
  
  // Proceed with approval...
}
```

### 🔒 Row Level Security (RLS) Policies

```sql
-- All authenticated users can read any surgery
CREATE POLICY "Authenticated read surgeries"
  ON public.surgeries FOR SELECT
  TO authenticated
  USING (true);

-- Only admins/managers can approve surgeries
CREATE POLICY "Admin/Manager approve surgeries"
  ON public.surgeries FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'manager')
  );

-- Users can only update their own profile
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);
```

---

## 5. Client Configuration

### 🌐 Browser Client (Client Components)
```typescript
// lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```
**Usage:**
```tsx
"use client"
import { createClient } from "@/lib/supabase/client"

const supabase = createClient()
const { data, error } = await supabase.from("surgeries").select()
```

### 🖥️ Server Client (Server Components & Actions)
```typescript
// lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  const cookieStore = await cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookies) { /* Set cookies */ }
      }
    }
  )
}
```
**Usage:**
```typescript
"use server"
import { createClient } from "@/lib/supabase/server"

const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
```

---

## 6. Session Management

### 🍪 Cookie-based Sessions

```
┌─────────────────────────────────────────┐
│  supabase-auth-token (httpOnly)         │
│  - JWT access token                     │
│  - Expires: 1 hour                      │
│  - Auto-refreshed by middleware         │
└─────────────────────────────────────────┘
```

**Token Contents (JWT Payload):**
```json
{
  "sub": "uuid-user-id",
  "email": "doctor@hospital.com",
  "role": "authenticated",
  "user_metadata": {
    "full_name": "Dr. John Smith",
    "role": "surgeon",
    "hospital": "City General Hospital"
  },
  "aud": "authenticated",
  "exp": 1707519600,
  "iat": 1707516000
}
```

---

## 7. Security Features

### ✅ Implemented Security Measures

1. **JWT Tokens**: Short-lived (1 hour), auto-refreshed
2. **httpOnly Cookies**: Prevents XSS attacks
3. **Row Level Security**: Database-level access control
4. **Password Hashing**: Bcrypt by Supabase
5. **Audit Logging**: All auth events tracked
6. **WebAuthn Support**: Phishing-resistant biometrics
7. **Challenge-Response**: Prevents replay attacks
8. **Role Verification**: Double-checked on login
9. **Middleware Protection**: Every route protected
10. **CSRF Protection**: Built into Next.js & Supabase

---

## 8. Development Bypass (Current Setup)

### 🔓 Auth Bypass for Testing

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  // 🔓 DEV MODE: Skip auth completely
  return NextResponse.next()  // Comment out in production
}

// lib/auth/devUser.ts
export function shouldBypassAuth(): boolean {
  return process.env.NODE_ENV === 'development'
}

// lib/auth/getAuthUser.ts
export async function getAuthUser() {
  if (shouldBypassAuth()) {
    return { user: DEV_USER }  // Fake user for testing
  }
  // Real auth...
}
```

**To Re-enable Authentication:**
1. Update `middleware.ts` to call `updateSession(request)`
2. Remove dev bypass in `lib/auth/devUser.ts`
3. Restart dev server

---

## 9. Complete Request Flow Example

### 📝 Creating a Surgery (Full Stack)

```
1. User fills form on /surgeries page
       │
       ▼
2. Browser submits form to createSurgery()
   (app/actions/surgery.ts)
       │
       ▼
3. Server Action:
   - Creates server client
   - Calls getAuthUser() → validates JWT
   - Checks user role
       │
       ▼
4. If authorized:
   - Inserts to surgeries table
   - RLS policy validates user can insert
       │
       ▼
5. Supabase Database:
   - Checks RLS policies
   - Executes INSERT
   - Returns result
       │
       ▼
6. Server Action:
   - Logs to audit trail
   - Revalidates page cache
   - Returns success/error
       │
       ▼
7. Client receives response:
   - Shows toast notification
   - Refreshes surgery list
```

---

## 10. Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# WebAuthn Configuration
WEBAUTHN_RP_NAME=MedScheduler
WEBAUTHN_RP_ID=localhost
WEBAUTHN_ORIGIN=http://localhost:3000

# Development Bypass
NEXT_PUBLIC_DEV_BYPASS_AUTH=true  # ⚠️ Never in production
```

---

## Summary

**Authentication Stack:**
- ✅ Supabase Auth (JWT-based)
- ✅ Password authentication
- ✅ WebAuthn biometric authentication
- ✅ Middleware protection
- ✅ Row Level Security
- ✅ Role-based access control
- ✅ Audit logging

**Key Files:**
- `supabase/migrations/001_auth_schema.sql` - Database schema
- `lib/supabase/client.ts` - Browser client
- `lib/supabase/server.ts` - Server client
- `lib/supabase/middleware.ts` - Session validation
- `app/actions/auth.ts` - Auth actions
- `middleware.ts` - Route protection

**Security Principles:**
1. Never trust client-side data
2. Always verify JWT on server
3. Use RLS for data access control
4. Log all auth events
5. Use httpOnly cookies
6. Implement role checks in actions
