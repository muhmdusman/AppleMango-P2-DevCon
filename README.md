# AppleMango-P2-DevCon

## Hospital Operating Room Scheduler with Intelligent Conflict Resolution

**Problem Statement:** #2 — Hospital Operating Room Scheduler with Intelligent Conflict Resolution

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
# Fill in your Supabase URL, anon key, and other secrets

# 4. Run locally
npm run dev
# App runs at http://localhost:3000
```

---

## Technology Stack

### Frontend
- **Next.js 16** (App Router) — routing, server actions, SSR
- **React 19** — UI library
- **Tailwind CSS 4** — utility-first styling
- **shadcn/ui** — accessible, composable component library
- **React DnD** — drag-and-drop calendar scheduling
- **Chart.js** — analytics & dashboard visualizations

### Backend & Database
- **Supabase (PostgreSQL)** — database, storage, & real-time
- **Supabase Auth** — role-based authentication
- **Supabase Realtime** — WebSocket live schedule updates

### Security
- **WebAuthn / @simplewebauthn** — biometric fingerprint/face login (FIDO2)

### Offline Support
- **IndexedDB** — local caching of medical records for offline access
- **Background Sync API** — sync when back online
- **Web Crypto API** — encrypted local storage

### Deployment
- **Vercel** — hosting & CI/CD

### AI/ML
- Lightweight heuristic & rule-based models for real-time performance

---

## Features Implemented

- [x] Multi-tenant hospital management architecture
- [x] Comprehensive surgery request management
- [x] Intelligent constraint satisfaction scheduler
- [x] Priority queue system with dynamic reordering
- [x] Interactive drag-and-drop calendar interface (Gantt chart)
- [x] Equipment & resource management
- [x] Real-time notification & alert system (WebSocket)
- [x] Advanced search, filtering & pagination
- [x] Biometric authentication (WebAuthn)
- [x] Offline-first medical records access (IndexedDB)
- [x] AI: Surgery duration prediction model
- [x] AI: Schedule optimization recommender
- [x] AI: Equipment failure prediction
- [x] Dashboard analytics
- [x] Live deployment on Vercel

---

## Known Issues / Limitations

- Biometric login requires a WebAuthn-capable browser/device (Chrome, Edge, Safari with Touch ID/Face ID, Windows Hello).
- Offline mode stores a limited subset of records due to IndexedDB quota constraints.
- AI/ML models use lightweight heuristic approaches (not deep learning) due to hackathon time constraints; accuracy can be improved with real training data.
- Real-time notifications depend on active WebSocket connection; push notifications are not implemented.
- HIPAA compliance is considered but not fully audited.

---

## AI/ML Model Details & Training Approach

| Model                        | Approach                                                                 |
| ---------------------------- | ------------------------------------------------------------------------ |
| **Surgery Duration Prediction** | Complexity-based regression formula using procedure type, complexity level (1–5), surgeon historical performance, patient age/BMI/comorbidities, and time-of-day fatigue factor. |
| **Schedule Optimization**       | Greedy priority sorting algorithm that scores schedule quality, identifies high-risk slots, and suggests optimal surgery sequences.                                             |
| **Equipment Failure Prediction**| Usage-threshold alerting system based on equipment usage hours and maintenance history to predict failures proactively.                                                          |

**Why heuristic over heavy ML?**
- Explainable, fast, and suitable for real-time operational decision-making.
- No external training pipeline or GPU required.
- Can be upgraded to Random Forest / Gradient Boosting with sufficient historical data (e.g., MIMIC-III dataset).

---

## Admin / Test User Credentials (for Judges)

| Role            | Email                        | Password        |
| --------------- | ---------------------------- | --------------- |
| Hospital Admin  | admin@applemango.dev         | Admin@12345     |
| OR Manager      | manager@applemango.dev       | Manager@12345   |
| Surgeon         | surgeon@applemango.dev       | Surgeon@12345   |
| Scheduler       | scheduler@applemango.dev     | Scheduler@12345 |
| Nurse           | nurse@applemango.dev         | Nurse@12345     |

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
