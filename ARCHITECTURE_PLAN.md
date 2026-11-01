# ChargeNeighbor Implementation Blueprint & Roadmap

Based on the 32-page Product Requirements Document (PRD) for **ChargeNeighbor: Your neighborhood. Your next charge.**

---

## 1. System Architecture & Modular Layout

```
charge naighbour project/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py       # Supports SQLite (zero-setup local) & PostgreSQL+PostGIS
│   │   ├── deps.py           # Dependency injection (Auth, Roles, DB session)
│   │   ├── security.py       # JWT (access/refresh), bcrypt hashing
│   │   ├── modules/
│   │   │   ├── auth/         # Register, Login, Token Refresh, Mock OTP, Password Reset
│   │   │   ├── users/        # Profile, role switching (driver/host), public profiles
│   │   │   ├── vehicles/     # Vehicle CRUD + preset catalog (Tata Nexon EV, MG ZS, etc.)
│   │   │   ├── chargers/     # Charger CRUD, geodetic distance, pricing, specs
│   │   │   ├── availability/ # Weekly recurring rules, date blocks
│   │   │   ├── bookings/     # State machine, slot overlap prevention, cancellations
│   │   │   ├── sessions/     # Active session simulation (kW, kWh delivery, cost calculation)
│   │   │   ├── pricing/      # Paise calculation: energy, time, idle, platform fee, GST tax
│   │   │   ├── recommend/    # Explainable recommendation engine, reachability margin, score breakdown
│   │   │   ├── verification/ # Tiers 0 to 4 verification flows & admin reviews
│   │   │   ├── reviews/      # Rating & reviews with host reply
│   │   │   ├── notifications/# In-app notifications & mock dispatch
│   │   │   ├── admin/        # Verification approval, charger/user moderation, dispute resolution, audit logs
│   │   │   └── reports/      # Reporting listings & disputes
│   │   ├── integrations/
│   │   │   ├── routing.py    # OSRM router adapter with haversine 1.4x road factor fallback
│   │   │   ├── payments.py   # Mock payment provider (authorize, capture, refund)
│   │   │   ├── otp.py        # Mock OTP service
│   │   │   ├── email.py      # Console / local mock email dispatcher
│   │   │   └── storage.py    # Local file upload storage handler
│   │   └── workers/
│   │       ├── scheduler.py  # APScheduler in-process background worker
│   │       └── jobs.py       # Expire bookings, auto-cancellation alternatives, reminders, no-shows
│   ├── tests/
│   │   ├── unit/             # Reference 8% battery test case, reachability math, pricing formulas
│   │   └── evaluation/       # Synthetic evaluation harness (Section 16: baseline vs ChargeNeighbor)
│   ├── requirements.txt
│   └── seed_data.py          # Seeds pilot neighborhoods, vehicles, hosts, chargers
├── frontend/
│   ├── src/
│   │   ├── api/              # Axios client with JWT interceptor & typed endpoints
│   │   ├── auth/             # AuthContext, ProtectedRoute, RoleGuard
│   │   ├── components/
│   │   │   ├── common/       # Navbar, Footer, Modal, StatusBadges, DemoBanner
│   │   │   ├── map/          # Leaflet OpenStreetMap integration with custom charger pins
│   │   │   ├── chargers/     # Charger cards, specs, verification badges, pricing tooltip
│   │   │   └── booking/      # Slot selector, cost estimator breakdown, receipt dialog
│   │   ├── pages/
│   │   │   ├── public/       # Landing page, How It Works (verification tiers), Login, Register
│   │   │   ├── driver/       # Find chargers (Map/List), Smart Recommendations, My Bookings, Vehicles, History
│   │   │   ├── host/         # Host Dashboard (earnings, cancellation stats), My Chargers, Add/Edit Charger, Availability Calendar, Requests
│   │   │   └── admin/        # Admin Overview KPIs, Verification Queue, Reports & Disputes, Audit Log
│   │   └── App.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── index.html
└── README.md
```
