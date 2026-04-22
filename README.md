# HR Integrated Feedback System

A full-stack complaint management platform built for manufacturing plant environments. Employees submit complaints anonymously, HR manages the lifecycle, vendors respond to assigned cases, and management gets AI-powered analytics — all in one system.

---

## Live Demo

| Service | URL |
|---|---|
| Frontend | *Coming soon* |
| Backend API Docs | *Coming soon* |

> Login credentials for demo available on request.

---

## Overview

The system handles the full complaint lifecycle:

```
Employee submits → HR reviews → Vendor assigned → Vendor responds →
Admin approves → Superadmin final approval → Resolved → Employee notified
```

All actions are logged. Employees can track their complaint status at any time using a reference ID (e.g. `CN-007`) or a unique tracking link — no account needed.

---

## Features

### Employee (Public — no login)
- Submit complaints across 4 categories: Canteen, Locker, ESD, Transportation
- Upload photos/videos as evidence (JPG, PNG, MP4, MOV — up to 20MB each)
- Receive a reference ID and tracking link after submission
- Track live complaint status, HR replies, and full activity timeline

### Admin Portal
- Role-scoped dashboard — admin sees own plant only, superadmin sees all plants
- Complaint list with filter, search, sort, pagination, and CSV export
- Urgent queue with grouped urgency levels and next-action cues
- Status management, priority override, vendor assignment
- Send formal replies to employees (visible on their tracking page)
- AI-powered tools: auto-classify, sentiment analysis, translate (EN/MS), draft reply
- 2-stage approval workflow: admin → superadmin
- Full audit log on every action

### Vendor Portal
- View assigned cases and attachments
- Submit responses with solution notes and photos
- Access via 30-day device token (no password required) or full login

### Analytics Dashboard (Superadmin)
- KPI metrics: resolution rate, avg resolution time, SLA breach %
- Trend charts (daily/weekly/monthly volume)
- Status breakdown, category performance, plant comparison
- Vendor reliability scoring
- Shift heatmap (Morning / Lunch / Tea Break / Dinner / Night)
- Sentiment analysis across complaints
- Anomaly detection — auto-flags volume spikes, overdue vendors, backlogs
- AI Root Cause Analysis — clusters complaint patterns using Llama 3.3 70B
- AI Insights — smart recommendations + 7-day workload forecast

### Notifications
- Email to employee on: submission, in-review, HR reply, resolved/closed
- Email to vendor on: case assigned (with deadline), SLA reminder, escalation
- All notifications via background tasks — never blocks API response

---

## Tech Stack

**Backend**
- Python 3.11, FastAPI (async)
- SQLAlchemy 2.0 async ORM, Alembic migrations
- PostgreSQL via Supabase
- APScheduler — background anomaly detection job (every 30 min)
- Groq API — Llama 3.3 70B for AI features (free tier)
- Resend — transactional email
- Supabase Storage — file uploads (free, no credit card)
- JWT authentication — httpOnly cookies, access + refresh tokens

**Frontend**
- React 18, TypeScript, Vite
- TanStack Query v5 — server state management
- Recharts — analytics charts
- Tailwind CSS + shadcn/ui

**Infrastructure**
- Backend: Railway
- Frontend: Vercel
- Database + Storage: Supabase (free tier)

---

## Project Structure

```
hr-feedback-system/
├── backend/
│   ├── app/
│   │   ├── models/          # SQLAlchemy models
│   │   ├── routers/         # FastAPI route handlers
│   │   ├── services/        # AI, storage, notifications
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── middleware/       # Auth dependencies
│   │   └── main.py
│   ├── alembic/             # DB migrations
│   ├── requirements.txt
│   ├── Procfile
│   └── runtime.txt
└── frontend/
    ├── src/
    │   ├── pages/           # Admin, Vendor, Public pages
    │   ├── components/      # Shared UI components
    │   ├── types/           # TypeScript interfaces
    │   ├── lib/             # API client, utilities
    │   └── context/         # Auth context
    └── vercel.json
```

---

## Roles

| Role | Access |
|---|---|
| **Public** | Submit complaint, track by reference ID or UUID |
| **Admin** | Manage complaints for their plant, assign vendors, send replies |
| **Superadmin** | Full access across all plants, final approval, user management |
| **Vendor** | View assigned cases, submit responses |

---

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- A Supabase project (free)
- A Groq API key (free)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:
```env
DATABASE_URL=postgresql+asyncpg://...
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

GROQ_API_KEY=your-groq-key

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_STORAGE_BUCKET=hr-feedback

RESEND_API_KEY=your-resend-key
FROM_EMAIL=hr@yourdomain.com
FRONTEND_URL=http://localhost:5174
```

Run migrations and start:
```bash
alembic upgrade head
uvicorn app.main:app --reload
```

API docs available at `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:
```env
VITE_API_URL=http://localhost:8000
```

```bash
npm run dev
```

---

## Deployment

| Service | Platform | Config |
|---|---|---|
| Backend | Railway | Root dir: `backend`, env vars in dashboard |
| Frontend | Vercel | Root dir: `frontend`, `VITE_API_URL` env var |
| Database | Supabase | Free tier, connection string in Railway |
| File Storage | Supabase Storage | Public bucket `hr-feedback` |

After deploying both services, update `FRONTEND_URL` in Railway to your Vercel URL to fix CORS.

Run migrations on production:
```bash
npm install -g @railway/cli
railway login
railway link
railway run alembic upgrade head
```

---

## API Endpoints

| Group | Prefix | Description |
|---|---|---|
| Public | `/api/submit` | Complaint submission |
| Public | `/api/track/{token}` | Complaint tracking |
| Auth | `/api/auth/` | Login, refresh, logout |
| Admin | `/api/admin/` | Complaint management, users, vendors |
| Superadmin | `/api/superadmin/` | Approvals, cross-plant access |
| Vendor | `/api/vendor/` | Assigned cases, responses |
| Analytics | `/api/analytics/` | 12 analytics endpoints |
| Uploads | `/api/upload/` | File upload to Supabase Storage |

Full interactive docs: `https://your-railway-url.railway.app/docs`

---

## What's Coming (v1.1)

- [ ] SLA auto-escalation scheduler — auto-escalates vendor-overdue complaints
- [ ] Reports module — AI-generated weekly summary reports
- [ ] WhatsApp notifications — architecture ready, pending Twilio/Meta API integration
- [ ] Departments management page
- [ ] Profile page

---

## Notes

- Email notifications are built and wired — requires `RESEND_API_KEY` and a verified sending domain
- AI features (classify, sentiment, translate, root cause, insights) use Groq's free API — no cost
- File storage uses Supabase free tier — 1GB storage, no egress fees
- The system is currently scoped to 4 complaint categories (Canteen, Locker, ESD, Transportation) matching Jabil's operational structure

---

*Built as part of an industrial HR operations improvement initiative.*
