# ChargeNeighbor: Community EV Charging Platform

> **Tagline:** Your neighborhood. Your next charge.  
> Built strictly according to the 32-page ChargeNeighbor Product Requirements Document (PRD v1.0).

---

## 🌟 Key Features Implemented

1. **Modular Monolithic Backend (FastAPI + SQLAlchemy + Pydantic v2)**:
   - Full REST API with JWT authentication (`/auth/register`, `/auth/login`, `/auth/otp/verify`).
   - Role-Based Access Control (RBAC): `driver`, `host`, `admin`, with multi-role support.
   - Pricing formulas in integer **paise** with GST tax calculations and rupee formatting.
   - Background worker via **APScheduler** for unaccepted booking expiries and stale offer sweeps.

2. **Explainable Recommendation Engine (Section 7)**:
   - Evaluates true battery reachability with 20% safe margins:  
     `safe_range_km = (battery_pct / 100) * battery_kwh * efficiency_km_per_kwh * (1 - 0.20)`.
   - Multi-factor normalized scoring across Reachability Margin, Travel Time, Cost, Reliability, Verification, and Rating.
   - OSRM route duration + distance calculation with a 1.4x road factor fallback.
   - Transparent explanations: `"Top recommended because it is comfortably within your safe battery range, fast 14 min travel time, and highly economical (₹245 total)"`.
   - Clear uncertainty disclaimers: *Range is an estimate; traffic, temperature, speed, and battery health can change it.*

3. **Booking Engine & Cancellation Recovery Flow (Section 8)**:
   - Slot collision rejection (anti double-booking).
   - Concealed address and secret access codes revealed only upon booking confirmation.
   - Automated replacement offers: When a host cancels, the engine enqueues top alternative chargers with 1-click driver reassignment.

4. **Multi-Role Portals & Modern Responsive UI (React 18 + Vite)**:
   - **Driver Portal**: Real-time charger cards, quick Low Battery SOS mode, interactive booking breakdown modal.
   - **Host Portal**: Listing management, availability toggles, Bayesian reliability metric: `(completed + 1) / (confirmed + 2)`, monthly earnings.
   - **Admin Portal**: Tier 0 to 4 verification queue, listings moderation, platform KPI overview.

---

## 🚀 How to Run Locally

### 1. Backend Server
```powershell
cd "backend"
# Optional: run tests (including PRD Section 7.3 Reference Test)
python -m pytest tests/test_reference_case.py -v

# Start FastAPI server
python -m uvicorn app.main:app --port 8000 --host 0.0.0.0
```
- API Documentation (Swagger): [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Check: [http://localhost:8000/health](http://localhost:8000/health)

### 2. Frontend Web App
```powershell
cd "frontend"
npm run dev -- --port 5173 --host
```
- Web Application: [http://localhost:5173](http://localhost:5173)

---

## 🔑 Pre-Configured Test Accounts

| Role | Email | Password |
|---|---|---|
| **Driver (Asha)** | `driver@chargeneighbor.com` | `password123` |
| **Host (Ravi)** | `host@chargeneighbor.com` | `password123` |
| **Admin (Meera)** | `admin@chargeneighbor.com` | `admin123` |
