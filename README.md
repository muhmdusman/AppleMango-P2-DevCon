# AppleMango-P2-DevCon

## Hospital Operating Room Scheduler with Intelligent Conflict Resolution

**Problem Statement:** #2 — Hospital Operating Room Scheduler with Intelligent Conflict Resolution

**Live Demo:** [https://apple-mango-p2-dev-con.vercel.app](https://apple-mango-p2-dev-con.vercel.app)

---

## Team: AppleMango

| Name               | Role      |
| ------------------ | --------- |
| Muhammad Usman     | Backend   |
| Muhammad Muhaddis  | Frontend  |

---

## Setup Instructions

```bash
# 1. Clone the repository
git clone https://github.com/muhmdusman/AppleMango-P2-DevCon.git
cd AppleMango-P2-DevCon/hospital-scheduler

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Fill in your Supabase URL, anon key, service role key, and WebAuthn settings

# 4. Run locally
npm run dev
# App runs at http://localhost:3000

# 5. Seed demo data
# Login → go to Settings → click "Seed Demo Data"
# Generates 60 patients, 31 staff, and 50+ surgeries automatically
```

---

## Vercel Deployment Guide

### Step 1 — Import Repository

1. Go to [vercel.com/new](https://vercel.com/new)
2. Select **Import Git Repository** → choose `muhmdusman/AppleMango-P2-DevCon`
3. Set **Root Directory** to `hospital-scheduler`
4. Framework preset will auto-detect **Next.js**

### Step 2 — Environment Variables

Add these environment variables in Vercel's project settings (**Settings → Environment Variables**):

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://toylldnsofltvidcoaep.supabase.co` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIs...QkQggcHQ...` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIs...YP1kji4t...` | Supabase service role key (server-side only) |
| `WEBAUTHN_RP_NAME` | `MedScheduler` | Relying party display name |
| `WEBAUTHN_RP_ID` | `apple-mango-p2-dev-con.vercel.app` | Your Vercel domain (no protocol) |
| `WEBAUTHN_ORIGIN` | `https://apple-mango-p2-dev-con.vercel.app` | Full origin URL with `https://` |

> **Important:** For production, update `WEBAUTHN_RP_ID` to your actual Vercel domain and `WEBAUTHN_ORIGIN` to the full `https://` URL. These must match exactly for biometric login to work.

### Step 3 — Deploy

1. Click **Deploy** — Vercel will build and deploy automatically
2. After first deploy, update Supabase Auth settings:
   - Go to **Supabase Dashboard → Authentication → URL Configuration**
   - Add your Vercel URL to **Redirect URLs**: `https://your-app.vercel.app/**`

### Step 4 — Verify

1. Visit your deployed URL
2. Register a new account or use test credentials below
3. Seed demo data via **Settings → Seed Demo Data**

---

## Technology Stack

### Frontend
- **Next.js 16.1.6** (App Router) — SSR, server actions, Turbopack
- **React 19** — concurrent rendering, transitions
- **Tailwind CSS 4** — utility-first styling
- **shadcn/ui** — accessible, composable component library (New York style)
- **@hello-pangea/dnd** — drag-and-drop calendar scheduling
- **Chart.js + react-chartjs-2** — analytics bar/line charts
- **Sonner** — toast notifications
- **Lucide React** — icon library

### Backend & Database
- **Supabase (PostgreSQL)** — database, auth, real-time subscriptions
- **Supabase Auth** — email/password + WebAuthn biometric authentication
- **Supabase Admin API** — server-side user management (magic link session creation)
- **Server Actions** — Next.js server actions for all CRUD operations

### Security
- **WebAuthn / FIDO2** — biometric fingerprint/face login via `@simplewebauthn/browser` + `@simplewebauthn/server`
- **Role-Based Access Control (RBAC)** — 5 roles (Admin, Manager, Surgeon, Scheduler, Nurse)
- **Row Level Security (RLS)** — PostgreSQL policies on all tables
- **Web Crypto API** — AES-GCM encryption for offline cached data

### Offline Support
- **Service Worker** — cache-first for static assets, network-first for data
- **IndexedDB** — encrypted local storage of medical records
- **Background Sync API** — queues offline operations, syncs when back online
- **Session Persistence** — localStorage-based session caching for offline login
- **Conflict Resolution** — last-write-wins with timestamp comparison + merge

### AI/ML
- **Surgery Duration Prediction** — complexity-based regression model
- **Schedule Quality Scorer** — greedy optimizer with A-F grading
- **Equipment Failure Prediction** — usage-threshold analysis
- **Dynamic Priority Queue** — auto-escalation with aging factor

### Data Generation
- **@faker-js/faker** — realistic Pakistani names, ICD-10 procedure codes
- **60 unique patients** with randomized demographics (age, gender, BMI, ASA, comorbidities)
- **31 staff members** — 10 surgeons, 5 anesthesiologists, 10 nurses, 2 OR managers, 3 schedulers

### Deployment
- **Vercel** — hosting, CI/CD, edge network
- **GitHub** — version control, automated deployments

---

## Features Implemented

### Core Scheduling
- [x] Multi-tenant hospital management architecture
- [x] Surgery request management — create, edit, delete, view, approve/reject
- [x] Intelligent constraint satisfaction scheduler with hard/soft violation checks
- [x] Dynamic priority queue with age-based escalation and real-time reordering
- [x] Interactive drag-and-drop Gantt chart (7 AM – 8 PM timeline, 15-min increments)
- [x] **Optimistic drag-drop** — instant UI update on drop, server sync in background with rollback on error

### Analytics & Visualization
- [x] **Dynamic OR utilization chart** — computed from actual schedule slots vs 13-hour operating day
- [x] Dashboard with surgery distribution, trends, stats cards
- [x] CSV export for both schedule and surgery data
- [x] AI schedule quality score (A/B/C/D/F grading with disruption probability)

### Equipment & Resources
- [x] Equipment tracking and resource management
- [x] Equipment failure prediction based on usage patterns

### Authentication & Security
- [x] Email/password authentication via Supabase Auth
- [x] **WebAuthn biometric login** — fingerprint/face registration and login with session creation
- [x] Role-based access control (5 roles with scoped navigation and actions)
- [x] Auto-approved surgery creation (immediate scheduling availability)

### Offline & Real-Time
- [x] **Service worker** with offline page caching and asset caching
- [x] **Offline surgery creation** — queued in IndexedDB, synced when back online
- [x] **Session persistence** — stay logged in even when offline
- [x] **Online/offline status indicator** in sidebar with pending sync count
- [x] Real-time notification system with auto-refresh
- [x] Background Sync API integration

### Search & Data
- [x] Advanced search, filtering (status, priority), and pagination
- [x] Bulk demo data seeding — 60 patients, 31 staff, 50+ surgeries with one click
- [x] Full CRUD with server actions and path revalidation

---

## Known Issues / Limitations

- Biometric login requires a WebAuthn-capable browser/device (Chrome, Edge, Safari with Touch ID/Face ID, Windows Hello).
- For production WebAuthn, the `WEBAUTHN_RP_ID` must match the deployed domain exactly.
- Offline mode stores a limited subset of records due to IndexedDB quota constraints.
- AI/ML models use lightweight heuristic approaches (not deep learning) due to hackathon time constraints; accuracy can be improved with real training data.
- Real-time notifications depend on active connection; push notifications are not implemented.
- The `middleware` file uses Next.js 16's deprecated convention (proxy-based middleware is recommended for future versions).

---

## AI/ML Model Details & Training Approach

| Model                        | Approach                                                                 |
| ---------------------------- | ------------------------------------------------------------------------ |
| **Surgery Duration Prediction** | Complexity-based regression formula using procedure type, complexity level (1–5), surgeon historical performance, patient age/BMI/comorbidities, and time-of-day fatigue factor. |
| **Schedule Optimization**       | Greedy priority sorting algorithm that scores schedule quality, identifies high-risk slots, and suggests optimal surgery sequences.                                             |
| **Equipment Failure Prediction**| Usage-threshold alerting system based on equipment usage hours and maintenance history to predict failures proactively.                                                          |
| **Dynamic Priority Queue**     | Real-time priority scoring with aging factor — surgeries waiting longer get escalated automatically. Emergency > Urgent > Elective with configurable weights.                    |

**Why heuristic over heavy ML?**
- Explainable, fast, and suitable for real-time operational decision-making.
- No external training pipeline or GPU required.
- Can be upgraded to Random Forest / Gradient Boosting with sufficient historical data (e.g., MIMIC-III dataset).

---

## Admin / Test User Credentials

| Role            | Email                        | Password        |
| --------------- | ---------------------------- | --------------- |
| Hospital Admin  | admin@applemango.dev         | Admin@12345     |
| OR Manager      | manager@applemango.dev       | Manager@12345   |
| Surgeon         | surgeon@applemango.dev       | Surgeon@12345   |
| Scheduler       | scheduler@applemango.dev     | Scheduler@12345 |
| Nurse           | nurse@applemango.dev         | Nurse@12345     |

> After first login, go to **Settings → Seed Demo Data** to populate the database with 60 patients, 31 staff, and 50+ surgeries.

---

## Project Structure

```
hospital-scheduler/
├── app/
│   ├── (auth)/              # Login & signup pages
│   ├── (dashboard)/         # Dashboard, schedule, surgeries, equipment, etc.
│   ├── api/auth/            # WebAuthn API routes, OAuth callback, signout
│   ├── actions/             # Server actions (surgery CRUD, scheduling)
│   └── layout.tsx           # Root layout with OfflineProvider
├── components/
│   ├── dashboard/           # Stats cards, OR utilization chart
│   ├── schedule/            # Gantt chart schedule view with drag-drop
│   ├── surgeries/           # Surgery list with CRUD dialogs
│   ├── providers/           # OfflineProvider (service worker, sync)
│   ├── ui/                  # shadcn/ui components
│   └── app-sidebar.tsx      # Navigation sidebar with offline status
├── lib/
│   ├── supabase/            # Client, server, admin, middleware configs
│   ├── ai.ts                # AI schedule scorer
│   ├── data.ts              # Data access helpers
│   ├── ml.ts                # Surgery duration prediction model
│   ├── offline.ts           # IndexedDB, encryption, sync queue
│   ├── scheduler.ts         # Constraint checker
│   └── types.ts             # TypeScript interfaces
├── public/
│   └── sw.js                # Service worker for offline caching
└── supabase/
    └── migrations/          # Database schema migrations
```

---

## Scoring Breakdown (100 Points Total)

| Category                       | Points |
| ------------------------------ | ------ |
| Multi-Tenant Architecture      | 9      |
| Surgery Request Management     | 10     |
| Constraint Satisfaction Scheduler | 16  |
| Priority Queue System          | 10     |
| Drag-and-Drop Calendar         | 12     |
| Equipment Management           | 7      |
| Notification System            | 5      |
| Search & Pagination            | 6      |
| AI: Duration Prediction        | 12     |
| AI: Schedule Optimizer         | 5      |
| AI: Equipment Failure          | 3      |
| Deployment & Production        | 5      |
| **TOTAL**                      | **100**|

---

*Built with ❤️ by Team AppleMango at DevCon 2026*
