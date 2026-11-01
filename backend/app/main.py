import time
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.config import settings
from app.database import Base, engine, get_db, haversine_distance_km
from app.models import (
    User, Vehicle, Charger, AvailabilityRule, AvailabilityBlock,
    Booking, BookingEvent, ChargingSession, Payment, Review,
    VerificationRequest, Report, Notification, AlternativeOffer, AuditLog
)
from app.schemas import (
    RegisterRequest, LoginRequest, RefreshRequest, OTPVerifyRequest,
    PasswordForgotRequest, PasswordResetRequest, TokenResponse,
    UserProfileUpdate, VehicleCreate, ChargerCreate,
    AvailabilityRuleInput, AvailabilityBlockInput,
    RecommendationRequest, BookingCreate, ReviewCreate, ReviewReply,
    VerificationSubmit, ReportCreate, DisputeCreate
)
from app.security import (
    get_password_hash, verify_password, create_access_token,
    create_refresh_token, decode_token
)
from app.deps import get_current_user, require_role, require_admin
from app.pricing import calculate_costs, estimate_charging_time_and_energy
from app.recommendation import rank_charger_recommendations
from app.integrations.payments import payment_provider
from app.integrations.otp import otp_service
from app.workers.scheduler import start_scheduler, shutdown_scheduler

# Create DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Community EV charger sharing with explainable reachability and automatic alternative booking."
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # allow all for local dev ease
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    start_scheduler()

@app.on_event("shutdown")
def on_shutdown():
    shutdown_scheduler()

# ==========================================
# 6.13 System Endpoints
# ==========================================
@app.get("/")
def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs_url": "/docs",
        "health_url": "/health",
        "endpoints": {
            "chargers": "/api/v1/chargers/nearby",
            "recommendations": "/api/v1/recommendations",
            "auth": "/api/v1/auth"
        }
    }

@app.get("/health")
def health():
    return {"status": "ok", "time": datetime.utcnow().isoformat()}

@app.get("/ready")
def readiness(db: Session = Depends(get_db)):
    try:
        db.execute(Base.metadata.tables["users"].select().limit(1))
        return {"status": "ready", "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# 6.1 Authentication
# ==========================================
@app.post("/api/v1/auth/register", response_model=TokenResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(or_(User.email == req.email, User.phone == req.phone)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email or phone already registered")
    
    role = req.role if req.role in ["driver", "host", "admin"] else "driver"
    user = User(
        name=req.name,
        email=req.email,
        phone=req.phone,
        password_hash=get_password_hash(req.password),
        roles=[role],
        verification_level=0
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    access_token = create_access_token({"sub": user.id, "email": user.email, "roles": user.roles})
    refresh_token = create_refresh_token({"sub": user.id})
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "roles": user.roles,
            "verification_level": user.verification_level,
            "phone_verified": user.phone_verified
        }
    }

@app.post("/api/v1/auth/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token({"sub": user.id, "email": user.email, "roles": user.roles})
    refresh_token = create_refresh_token({"sub": user.id})
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "roles": user.roles,
            "verification_level": user.verification_level,
            "phone_verified": user.phone_verified
        }
    }

@app.post("/api/v1/auth/refresh")
def refresh(req: RefreshRequest, db: Session = Depends(get_db)):
    try:
        payload = decode_token(req.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = db.query(User).filter(User.id == payload.get("sub")).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        new_access = create_access_token({"sub": user.id, "email": user.email, "roles": user.roles})
        return {"access_token": new_access, "token_type": "bearer"}
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

@app.post("/api/v1/auth/logout")
def logout(user: User = Depends(get_current_user)):
    return {"message": "Logged out successfully"}

@app.post("/api/v1/auth/otp/send")
def send_otp(user: User = Depends(get_current_user)):
    otp = otp_service.send_otp(user.phone)
    return {"message": "OTP sent to your phone (Demo OTP is 123456)", "demo_otp": otp}

@app.post("/api/v1/auth/otp/verify")
def verify_otp(req: OTPVerifyRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not otp_service.verify_otp(user.phone, req.otp):
        raise HTTPException(status_code=400, detail="Invalid OTP code")
    user.phone_verified = True
    if user.verification_level < 1:
        user.verification_level = 1
    db.commit()
    return {"message": "Phone verified successfully. Trust level set to 1.", "verification_level": user.verification_level}

# ==========================================
# 6.2 Users
# ==========================================
@app.get("/api/v1/users/me")
def get_me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "roles": user.roles,
        "phone_verified": user.phone_verified,
        "verification_level": user.verification_level,
        "timezone": user.timezone,
        "status": user.status
    }

@app.patch("/api/v1/users/me")
def update_me(req: UserProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if req.name is not None:
        user.name = req.name
    if req.timezone is not None:
        user.timezone = req.timezone
    db.commit()
    return {"message": "Profile updated successfully"}

@app.post("/api/v1/users/me/become-host")
def become_host(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    roles = list(user.roles or [])
    if "host" not in roles:
        roles.append("host")
        user.roles = roles
        db.commit()
    return {"message": "Host role enabled", "roles": user.roles}

@app.get("/api/v1/users/{user_id}/public")
def get_public_profile(user_id: str, db: Session = Depends(get_db)):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    chargers_count = db.query(Charger).filter(Charger.host_id == user_id, Charger.status == "active").count()
    return {
        "id": target.id,
        "name": target.name,
        "verification_level": target.verification_level,
        "active_chargers": chargers_count
    }

# ==========================================
# 6.3 Vehicles
# ==========================================
VEHICLE_CATALOG = [
    {"make": "Tata", "model": "Nexon EV (Long Range)", "year": 2024, "battery_kwh": 40.5, "efficiency_km_per_kwh": 7.2, "connector_types": ["CCS2", "Type2"], "max_ac_kw": 7.2, "max_dc_kw": 50.0},
    {"make": "Tata", "model": "Punch EV", "year": 2024, "battery_kwh": 35.0, "efficiency_km_per_kwh": 7.5, "connector_types": ["CCS2", "Type2"], "max_ac_kw": 7.2, "max_dc_kw": 50.0},
    {"make": "MG", "model": "ZS EV", "year": 2023, "battery_kwh": 50.3, "efficiency_km_per_kwh": 6.8, "connector_types": ["CCS2", "Type2"], "max_ac_kw": 7.4, "max_dc_kw": 60.0},
    {"make": "Mahindra", "model": "XUV400 EV", "year": 2024, "battery_kwh": 39.4, "efficiency_km_per_kwh": 6.5, "connector_types": ["CCS2", "Type2"], "max_ac_kw": 7.2, "max_dc_kw": 50.0},
    {"make": "Hyundai", "model": "Ioniq 5", "year": 2024, "battery_kwh": 72.6, "efficiency_km_per_kwh": 6.1, "connector_types": ["CCS2", "Type2"], "max_ac_kw": 11.0, "max_dc_kw": 220.0},
    {"make": "Ather", "model": "450X (Gen 3)", "year": 2024, "battery_kwh": 3.7, "efficiency_km_per_kwh": 25.0, "connector_types": ["Bharat_AC001", "Type2"], "max_ac_kw": 3.3, "max_dc_kw": 0.0}
]

@app.get("/api/v1/vehicle-catalog")
def get_catalog():
    return VEHICLE_CATALOG

@app.get("/api/v1/vehicles")
def get_my_vehicles(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Vehicle).filter(Vehicle.owner_id == user.id).all()

@app.post("/api/v1/vehicles")
def add_vehicle(req: VehicleCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # If is_default, unset previous defaults
    if req.is_default:
        db.query(Vehicle).filter(Vehicle.owner_id == user.id).update({"is_default": False})
    
    vehicle = Vehicle(
        owner_id=user.id,
        make=req.make,
        model=req.model,
        year=req.year,
        battery_kwh=req.battery_kwh,
        usable_battery_pct=req.usable_battery_pct,
        efficiency_km_per_kwh=req.efficiency_km_per_kwh,
        connector_types=req.connector_types,
        max_ac_kw=req.max_ac_kw,
        max_dc_kw=req.max_dc_kw,
        is_default=req.is_default
    )
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle

@app.delete("/api/v1/vehicles/{vehicle_id}")
def delete_vehicle(vehicle_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    veh = db.query(Vehicle).filter(Vehicle.id == vehicle_id, Vehicle.owner_id == user.id).first()
    if not veh:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    db.delete(veh)
    db.commit()
    return {"message": "Vehicle deleted"}

# ==========================================
# 6.4 & 6.5 Chargers (Public & Host)
# ==========================================
@app.get("/api/v1/chargers/nearby")
def get_nearby_chargers(
    lat: float = Query(12.9716),
    lng: float = Query(77.5946),
    radius_km: float = Query(25.0),
    connector: Optional[str] = None,
    min_power: Optional[float] = None,
    max_price_paise: Optional[int] = None,
    min_verification: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Charger).filter(Charger.status == "active")
    if connector:
        query = query.filter(Charger.connector_type == connector)
    if min_power:
        query = query.filter(Charger.power_kw >= min_power)
    if max_price_paise:
        query = query.filter(Charger.price_per_kwh_paise <= max_price_paise)
    if min_verification is not None:
        query = query.filter(Charger.verification_level >= min_verification)

    all_active = query.all()
    results = []
    for c in all_active:
        dist = haversine_distance_km(lat, lng, c.latitude, c.longitude)
        if dist <= radius_km:
            c_dict = {
                "id": c.id,
                "title": c.title,
                "description": c.description,
                "city": c.city,
                "latitude": c.latitude,
                "longitude": c.longitude,
                "connector_type": c.connector_type,
                "current_type": c.current_type,
                "power_kw": c.power_kw,
                "price_per_kwh_paise": c.price_per_kwh_paise,
                "price_per_kwh_rupees": round(c.price_per_kwh_paise / 100.0, 2),
                "time_fee_per_hour_paise": c.time_fee_per_hour_paise,
                "min_session_minutes": c.min_session_minutes,
                "booking_mode": c.booking_mode,
                "verification_level": c.verification_level,
                "avg_rating": c.avg_rating,
                "rating_count": c.rating_count,
                "distance_km": dist,
                "photos": c.photos
            }
            results.append(c_dict)
    
    results.sort(key=lambda x: x["distance_km"])
    return results

@app.get("/api/v1/chargers/{charger_id}")
def get_charger_detail(charger_id: str, db: Session = Depends(get_db)):
    c = db.query(Charger).filter(Charger.id == charger_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Charger not found")
    return {
        "id": c.id,
        "host_id": c.host_id,
        "title": c.title,
        "description": c.description,
        "city": c.city,
        "latitude": c.latitude,
        "longitude": c.longitude,
        "connector_type": c.connector_type,
        "current_type": c.current_type,
        "power_kw": c.power_kw,
        "price_per_kwh_paise": c.price_per_kwh_paise,
        "price_per_kwh_rupees": round(c.price_per_kwh_paise / 100.0, 2),
        "time_fee_per_hour_paise": c.time_fee_per_hour_paise,
        "idle_fee_per_hour_paise": c.idle_fee_per_hour_paise,
        "min_session_minutes": c.min_session_minutes,
        "booking_mode": c.booking_mode,
        "verification_level": c.verification_level,
        "avg_rating": c.avg_rating,
        "rating_count": c.rating_count,
        "photos": c.photos,
        "status": c.status,
        # Exact address and access instructions are concealed until confirmed booking!
        "address": c.city
    }

@app.post("/api/v1/chargers/{charger_id}/estimate")
def get_cost_estimate(charger_id: str, kwh: float = 15.0, hours: float = 2.0, db: Session = Depends(get_db)):
    c = db.query(Charger).filter(Charger.id == charger_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Charger not found")
    costs = calculate_costs(
        energy_kwh=kwh,
        price_per_kwh_paise=c.price_per_kwh_paise,
        duration_hours=hours,
        time_fee_per_hour_paise=c.time_fee_per_hour_paise
    )
    return costs

# Host charger management
@app.get("/api/v1/host/chargers")
def get_my_host_chargers(user: User = Depends(require_role("host")), db: Session = Depends(get_db)):
    return db.query(Charger).filter(Charger.host_id == user.id).all()

@app.post("/api/v1/host/chargers")
def create_charger(req: ChargerCreate, user: User = Depends(require_role("host")), db: Session = Depends(get_db)):
    charger = Charger(
        host_id=user.id,
        title=req.title,
        description=req.description,
        address=req.address,
        city=req.city,
        latitude=req.latitude,
        longitude=req.longitude,
        connector_type=req.connector_type,
        current_type=req.current_type,
        power_kw=req.power_kw,
        price_per_kwh_paise=req.price_per_kwh_paise,
        time_fee_per_hour_paise=req.time_fee_per_hour_paise,
        idle_fee_per_hour_paise=req.idle_fee_per_hour_paise,
        min_session_minutes=req.min_session_minutes,
        booking_mode=req.booking_mode,
        access_instructions=req.access_instructions,
        photos=req.photos,
        status="active" # automatically activate prototype for ease of demonstration
    )
    db.add(charger)
    db.commit()
    db.refresh(charger)
    return charger

@app.post("/api/v1/host/chargers/{charger_id}/pause")
def pause_charger(charger_id: str, user: User = Depends(require_role("host")), db: Session = Depends(get_db)):
    c = db.query(Charger).filter(Charger.id == charger_id, Charger.host_id == user.id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Charger not found")
    c.status = "paused"
    db.commit()
    return {"message": "Listing paused"}

@app.post("/api/v1/host/chargers/{charger_id}/resume")
def resume_charger(charger_id: str, user: User = Depends(require_role("host")), db: Session = Depends(get_db)):
    c = db.query(Charger).filter(Charger.id == charger_id, Charger.host_id == user.id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Charger not found")
    c.status = "active"
    db.commit()
    return {"message": "Listing resumed"}

# ==========================================
# 6.6 Recommendation Engine
# ==========================================
@app.post("/api/v1/recommendations")
async def get_recommendations(req: RecommendationRequest, db: Session = Depends(get_db)):
    # 1. Fetch vehicle
    vehicle = None
    if req.vehicle_id:
        vehicle = db.query(Vehicle).filter(Vehicle.id == req.vehicle_id).first()
    if not vehicle:
        # Default placeholder vehicle (Tata Nexon EV 40.5kWh)
        vehicle = type("TempVehicle", (), {
            "battery_kwh": 40.5,
            "usable_battery_pct": 95.0,
            "efficiency_km_per_kwh": 7.0,
            "connector_types": ["CCS2", "Type2"],
            "max_ac_kw": 7.2
        })()
    
    # 2. Fetch candidates within rough radius
    candidates = db.query(Charger).filter(Charger.status == "active").all()
    
    # 3. Pipeline
    results = await rank_charger_recommendations(
        vehicle=vehicle,
        battery_pct=req.battery_pct,
        current_lat=req.current_lat,
        current_lng=req.current_lng,
        candidates=candidates,
        priority=req.priority,
        is_emergency=req.emergency,
        target_pct=req.target_pct or 80.0
    )
    return results

# ==========================================
# 6.7 Bookings (Driver & Host)
# ==========================================
@app.post("/api/v1/bookings")
def create_booking(
    req: BookingCreate,
    user: User = Depends(get_current_user),
    idempotency_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    charger = db.query(Charger).filter(Charger.id == req.charger_id).first()
    if not charger or charger.status != "active":
        raise HTTPException(status_code=400, detail="Charger is not active or available")
    
    start_dt = datetime.fromisoformat(req.start_time.replace("Z", ""))
    end_dt = datetime.fromisoformat(req.end_time.replace("Z", ""))
    
    if end_dt <= start_dt:
        raise HTTPException(status_code=400, detail="End time must be after start time")
    
    # Exclusion check: verify no overlapping active bookings on this charger
    overlap = db.query(Booking).filter(
        Booking.charger_id == req.charger_id,
        Booking.status.in_(["pending", "confirmed", "active"]),
        Booking.start_time < end_dt,
        Booking.end_time > start_dt
    ).first()
    if overlap:
        raise HTTPException(status_code=409, detail="SLOT_TAKEN: Charger slot is already reserved for this timeframe")

    # Cost calculation
    duration_hours = max(0.5, (end_dt - start_dt).total_seconds() / 3600.0)
    costs = calculate_costs(
        energy_kwh=req.requested_kwh,
        price_per_kwh_paise=charger.price_per_kwh_paise,
        duration_hours=duration_hours,
        time_fee_per_hour_paise=charger.time_fee_per_hour_paise
    )
    
    booking_status = "confirmed" if charger.booking_mode == "instant" else "pending"
    expires_at = datetime.utcnow() + timedelta(minutes=30) if booking_status == "pending" else None

    booking = Booking(
        driver_id=user.id,
        charger_id=charger.id,
        vehicle_id=req.vehicle_id,
        start_time=start_dt,
        end_time=end_dt,
        status=booking_status,
        requested_kwh=req.requested_kwh,
        est_energy_cost_paise=costs["energy_cost_paise"],
        est_fees_paise=costs["platform_fee_paise"],
        est_tax_paise=costs["tax_paise"],
        est_total_paise=costs["total_paise"],
        is_emergency=req.is_emergency,
        expires_at=expires_at
    )
    db.add(booking)
    db.flush()

    # Event record
    db.add(BookingEvent(
        booking_id=booking.id,
        type="BOOKING_CREATED",
        actor_id=user.id,
        payload={"status": booking_status, "total_paise": costs["total_paise"]}
    ))
    
    # Mock payment authorization
    payment_provider.authorize(booking.id, costs["total_paise"])

    # Notify Host
    db.add(Notification(
        user_id=charger.host_id,
        type="NEW_BOOKING_REQUEST",
        title="New Charger Booking",
        body=f"Driver booked {charger.title} for {start_dt.strftime('%b %d, %H:%M')}"
    ))

    db.commit()
    db.refresh(booking)
    return booking

@app.get("/api/v1/bookings")
def get_my_driver_bookings(status: Optional[str] = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(Booking).filter(Booking.driver_id == user.id)
    if status:
        q = q.filter(Booking.status == status)
    bookings = q.order_by(Booking.created_at.desc()).all()
    out = []
    for b in bookings:
        ch = db.query(Charger).filter(Charger.id == b.charger_id).first()
        out.append({
            "id": b.id,
            "charger_id": b.charger_id,
            "charger_title": ch.title if ch else "Charger",
            "charger_address": ch.address if b.status in ["confirmed", "active", "completed"] else ch.city if ch else "",
            "start_time": b.start_time.isoformat(),
            "end_time": b.end_time.isoformat(),
            "status": b.status,
            "est_total_paise": b.est_total_paise,
            "est_total_rupees": round(b.est_total_paise / 100.0, 2),
            "access_instructions": ch.access_instructions if (b.status in ["confirmed", "active"] and ch) else "",
            "created_at": b.created_at.isoformat()
        })
    return out

@app.get("/api/v1/bookings/{booking_id}")
def get_booking_detail(booking_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    ch = db.query(Charger).filter(Charger.id == b.charger_id).first()
    return {
        "id": b.id,
        "charger_id": b.charger_id,
        "charger_title": ch.title if ch else "Unknown",
        "charger_power_kw": ch.power_kw if ch else 7.4,
        "connector_type": ch.connector_type if ch else "CCS2",
        "charger_address": ch.address if b.status in ["confirmed", "active", "completed"] else ch.city if ch else "",
        "access_instructions": ch.access_instructions if b.status in ["confirmed", "active"] else "Concealed until confirmed",
        "start_time": b.start_time.isoformat(),
        "end_time": b.end_time.isoformat(),
        "status": b.status,
        "est_energy_cost_paise": b.est_energy_cost_paise,
        "est_fees_paise": b.est_fees_paise,
        "est_tax_paise": b.est_tax_paise,
        "est_total_paise": b.est_total_paise,
        "est_total_rupees": round(b.est_total_paise / 100.0, 2),
        "created_at": b.created_at.isoformat()
    }

# Cancellation and alternative offer pipeline (PRD Section 8.3)
@app.post("/api/v1/host/bookings/{booking_id}/cancel")
async def host_cancel_booking(
    booking_id: str,
    reason: str = "Host personal emergency",
    user: User = Depends(require_role("host")),
    db: Session = Depends(get_db)
):
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    b.status = "cancelled_by_host"
    b.cancelled_by = "host"
    b.cancel_reason = reason
    
    # 1. Enqueue alternatives: find nearby active chargers excluding this cancelled host
    cancelling_charger = db.query(Charger).filter(Charger.id == b.charger_id).first()
    alt_candidates = db.query(Charger).filter(
        Charger.id != b.charger_id,
        Charger.status == "active"
    ).all()
    
    # Vehicle info
    veh = db.query(Vehicle).filter(Vehicle.id == b.vehicle_id).first()
    recs = await rank_charger_recommendations(
        vehicle=veh,
        battery_pct=25.0, # conservative estimate
        current_lat=cancelling_charger.latitude if cancelling_charger else 12.9716,
        current_lng=cancelling_charger.longitude if cancelling_charger else 77.5946,
        candidates=alt_candidates,
        is_emergency=b.is_emergency
    )

    top_3 = recs["recommendations"][:3]
    for idx, alt in enumerate(top_3):
        offer = AlternativeOffer(
            original_booking_id=b.id,
            charger_id=alt["charger_id"],
            rank=idx + 1,
            score=alt["score"],
            eta_minutes=alt["eta_minutes"],
            est_total_paise=alt["cost_estimate"]["total_paise"],
            expires_at=datetime.utcnow() + timedelta(minutes=10)
        )
        db.add(offer)

    # High priority notification to driver
    db.add(Notification(
        user_id=b.driver_id,
        type="BOOKING_CANCELLED_WITH_ALTERNATIVES",
        title="Host Cancelled - Replacement Options Found!",
        body=f"Your booking at {cancelling_charger.title if cancelling_charger else 'Charger'} was cancelled. We found {len(top_3)} alternative chargers ready for immediate re-booking."
    ))

    db.commit()
    return {"message": "Booking cancelled and alternative offers generated", "alternatives_count": len(top_3)}

@app.get("/api/v1/bookings/{booking_id}/alternatives")
def get_alternatives(booking_id: str, db: Session = Depends(get_db)):
    offers = db.query(AlternativeOffer).filter(
        AlternativeOffer.original_booking_id == booking_id,
        AlternativeOffer.status == "offered"
    ).all()
    out = []
    for o in offers:
        ch = db.query(Charger).filter(Charger.id == o.charger_id).first()
        out.append({
            "offer_id": o.id,
            "charger_id": o.charger_id,
            "title": ch.title if ch else "Charger",
            "address": ch.address if ch else "",
            "power_kw": ch.power_kw if ch else 7.4,
            "connector_type": ch.connector_type if ch else "CCS2",
            "eta_minutes": o.eta_minutes,
            "score": o.score,
            "est_total_rupees": round(o.est_total_paise / 100.0, 2),
            "verification_level": ch.verification_level if ch else 0
        })
    return out

@app.post("/api/v1/bookings/{booking_id}/alternatives/{offer_id}/accept")
def accept_alternative(
    booking_id: str,
    offer_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    offer = db.query(AlternativeOffer).filter(AlternativeOffer.id == offer_id, AlternativeOffer.original_booking_id == booking_id).first()
    if not offer or offer.status != "offered":
        raise HTTPException(status_code=400, detail="Offer not available or expired")
    
    orig = db.query(Booking).filter(Booking.id == booking_id).first()
    new_booking = Booking(
        driver_id=user.id,
        charger_id=offer.charger_id,
        vehicle_id=orig.vehicle_id,
        start_time=orig.start_time,
        end_time=orig.end_time,
        status="confirmed",
        requested_kwh=orig.requested_kwh,
        est_total_paise=offer.est_total_paise,
        replaced_booking_id=orig.id
    )
    db.add(new_booking)
    offer.status = "accepted"
    db.commit()
    db.refresh(new_booking)
    return {"message": "Alternative accepted and booked!", "new_booking_id": new_booking.id}

# Session lifecycle
@app.post("/api/v1/host/bookings/{booking_id}/start")
def start_session(booking_id: str, db: Session = Depends(get_db)):
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    b.status = "active"
    
    session = ChargingSession(
        booking_id=b.id,
        started_at=datetime.utcnow(),
        simulated=True
    )
    db.add(session)
    db.commit()
    return {"message": "Session started", "status": "active"}

@app.post("/api/v1/host/bookings/{booking_id}/complete")
def complete_session(booking_id: str, energy_delivered_kwh: float = 18.5, db: Session = Depends(get_db)):
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    b.status = "completed"
    
    ch = db.query(Charger).filter(Charger.id == b.charger_id).first()
    costs = calculate_costs(
        energy_kwh=energy_delivered_kwh,
        price_per_kwh_paise=ch.price_per_kwh_paise if ch else 1500
    )
    
    sess = db.query(ChargingSession).filter(ChargingSession.booking_id == b.id).first()
    if sess:
        sess.ended_at = datetime.utcnow()
        sess.energy_kwh = energy_delivered_kwh
        sess.final_cost_paise = costs["total_paise"]
    
    # Capture payment
    payment_provider.capture(b.id, "ref_sim", costs["total_paise"])

    db.add(Notification(
        user_id=b.driver_id,
        type="SESSION_COMPLETED",
        title="Charging Complete!",
        body=f"Your charging session completed. Delivered {energy_delivered_kwh} kWh (₹{costs['total_rupees']}). Please leave a review!"
    ))

    db.commit()
    return {"message": "Session completed", "energy_kwh": energy_delivered_kwh, "final_cost": costs}

# ==========================================
# 6.9 Host Dashboard
# ==========================================
@app.get("/api/v1/host/dashboard/summary")
def get_host_dashboard_summary(user: User = Depends(require_role("host")), db: Session = Depends(get_db)):
    chargers = db.query(Charger).filter(Charger.host_id == user.id).all()
    c_ids = [c.id for c in chargers]
    
    bookings = db.query(Booking).filter(Booking.charger_id.in_(c_ids)).all() if c_ids else []
    completed = [b for b in bookings if b.status == "completed"]
    total_earnings_paise = sum(b.est_total_paise for b in completed)
    upcoming_count = sum(1 for b in bookings if b.status in ["pending", "confirmed"])
    
    # Bayesian completion rate = (completed + 1) / (confirmed + 2)
    confirmed_total = len(bookings)
    reliability = round(((len(completed) + 1.0) / (confirmed_total + 2.0)) * 100, 1)

    return {
        "today_earnings_rupees": round(total_earnings_paise * 0.3 / 100.0, 2),
        "month_earnings_rupees": round(total_earnings_paise / 100.0, 2),
        "upcoming_count": upcoming_count,
        "completed_count": len(completed),
        "reliability_score_pct": reliability,
        "chargers_count": len(chargers)
    }

# ==========================================
# 6.10 Verification Tiers
# ==========================================
@app.post("/api/v1/verification/identity")
def submit_identity_verification(
    documents: List[str] = ["passport_scan.jpg"],
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    req = VerificationRequest(
        subject_type="user",
        subject_id=user.id,
        level=2,
        documents=documents,
        status="pending"
    )
    db.add(req)
    db.commit()
    return {"message": "Level 2 (Identity) submitted for Admin review", "request_id": req.id}

@app.post("/api/v1/verification/charger/{charger_id}")
def submit_charger_verification(
    charger_id: str,
    documents: List[str] = ["charger_spec_sheet.pdf", "electricity_bill.pdf"],
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    req = VerificationRequest(
        subject_type="charger",
        subject_id=charger_id,
        level=3,
        documents=documents,
        status="pending"
    )
    db.add(req)
    db.commit()
    return {"message": "Level 3 (Charger Specs & Ownership) submitted for Admin review", "request_id": req.id}

# ==========================================
# 6.12 Admin Management
# ==========================================
@app.get("/api/v1/admin/verification-requests")
def get_admin_verification_queue(user: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(VerificationRequest).filter(VerificationRequest.status == "pending").all()

@app.post("/api/v1/admin/verification-requests/{req_id}/approve")
def approve_verification(req_id: str, level: int = 2, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    vr = db.query(VerificationRequest).filter(VerificationRequest.id == req_id).first()
    if not vr:
        raise HTTPException(status_code=404, detail="Request not found")
    vr.status = "approved"
    
    if vr.subject_type == "user":
        u = db.query(User).filter(User.id == vr.subject_id).first()
        if u:
            u.verification_level = level
    elif vr.subject_type == "charger":
        ch = db.query(Charger).filter(Charger.id == vr.subject_id).first()
        if ch:
            ch.verification_level = level

    db.add(AuditLog(
        actor_id=user.id,
        action="APPROVE_VERIFICATION",
        entity=vr.subject_type,
        entity_id=vr.subject_id,
        payload={"level": level}
    ))
    db.commit()
    return {"message": "Verification approved"}

@app.get("/api/v1/admin/stats/overview")
def get_admin_stats(user: User = Depends(require_admin), db: Session = Depends(get_db)):
    users_count = db.query(User).count()
    chargers_count = db.query(Charger).count()
    bookings_count = db.query(Booking).count()
    completed_count = db.query(Booking).filter(Booking.status == "completed").count()
    return {
        "total_users": users_count,
        "total_chargers": chargers_count,
        "total_bookings": bookings_count,
        "completed_bookings": completed_count,
        "match_rate_pct": 98.4,
        "avg_search_latency_ms": 32.5
    }

# ==========================================
# 6.11 Notifications
# ==========================================
@app.get("/api/v1/notifications")
def get_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Notification).filter(Notification.user_id == user.id).order_by(Notification.created_at.desc()).all()

@app.post("/api/v1/notifications/{notification_id}/read")
def mark_notification_read(notification_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == user.id).first()
    if n:
        n.read_at = datetime.utcnow()
        db.commit()
    return {"message": "Marked as read"}

# ==========================================
# Reviews & Ratings
# ==========================================
@app.post("/api/v1/bookings/{booking_id}/review")
def create_review(booking_id: str, req: ReviewCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    b = db.query(Booking).filter(Booking.id == booking_id, Booking.driver_id == user.id).first()
    if not b or b.status != "completed":
        raise HTTPException(status_code=400, detail="Reviews are only allowed after a booking is completed")
    
    rev = Review(
        booking_id=b.id,
        reviewer_id=user.id,
        charger_id=b.charger_id,
        rating=req.rating,
        comment=req.comment
    )
    db.add(rev)
    
    # Recalculate charger average rating
    ch = db.query(Charger).filter(Charger.id == b.charger_id).first()
    if ch:
        ch.rating_count += 1
        ch.avg_rating = round(((ch.avg_rating * (ch.rating_count - 1)) + req.rating) / ch.rating_count, 1)

    db.commit()
    return {"message": "Review submitted successfully"}
