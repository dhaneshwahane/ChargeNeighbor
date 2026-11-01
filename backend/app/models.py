import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Boolean, Integer, Float, DateTime, ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    phone = Column(String(30), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    roles = Column(JSON, default=["driver"]) # ["driver"], ["host"], or ["driver", "host", "admin"]
    phone_verified = Column(Boolean, default=False)
    status = Column(String(20), default="active") # active, suspended
    timezone = Column(String(50), default="Asia/Kolkata")
    verification_level = Column(Integer, default=0) # 0 to 4
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    vehicles = relationship("Vehicle", back_populates="owner", cascade="all, delete-orphan")
    chargers = relationship("Charger", back_populates="host", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="driver", foreign_keys="Booking.driver_id")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")


class Vehicle(Base):
    __tablename__ = "vehicles"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    make = Column(String(50), nullable=False)
    model = Column(String(50), nullable=False)
    year = Column(Integer, nullable=False)
    battery_kwh = Column(Float, nullable=False) # Total capacity
    usable_battery_pct = Column(Float, default=95.0) # Check: between 1 and 100
    efficiency_km_per_kwh = Column(Float, nullable=False) # e.g. 6.5 km/kWh
    connector_types = Column(JSON, nullable=False) # e.g. ["CCS2", "Type2"]
    max_ac_kw = Column(Float, default=7.4)
    max_dc_kw = Column(Float, default=50.0)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="vehicles")
    bookings = relationship("Booking", back_populates="vehicle")


class Charger(Base):
    __tablename__ = "chargers"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    host_id = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String(150), nullable=False)
    description = Column(Text, default="")
    address = Column(String(255), nullable=False)
    city = Column(String(100), default="Bengaluru")
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    connector_type = Column(String(30), nullable=False) # Type2, CCS2, CHAdeMO, GBT, Bharat_AC001, Bharat_DC001, Type1, Other
    current_type = Column(String(10), default="AC") # AC / DC
    power_kw = Column(Float, nullable=False) # e.g. 7.4 kW
    
    # Pricing in paise
    price_per_kwh_paise = Column(Integer, nullable=False) # e.g. 1500 (₹15.00)
    time_fee_per_hour_paise = Column(Integer, default=0)
    idle_fee_per_hour_paise = Column(Integer, default=0)
    min_session_minutes = Column(Integer, default=30)
    
    booking_mode = Column(String(20), default="instant") # instant, approval
    access_instructions = Column(Text, default="") # Only shown after booking confirmed!
    photos = Column(JSON, default=[])
    status = Column(String(20), default="draft") # draft, pending_review, active, paused, suspended
    verification_level = Column(Integer, default=0) # 0 to 4
    avg_rating = Column(Float, default=5.0)
    rating_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    host = relationship("User", back_populates="chargers")
    availability_rules = relationship("AvailabilityRule", back_populates="charger", cascade="all, delete-orphan")
    availability_blocks = relationship("AvailabilityBlock", back_populates="charger", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="charger")
    reviews = relationship("Review", back_populates="charger")


class AvailabilityRule(Base):
    __tablename__ = "availability_rules"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    charger_id = Column(String, ForeignKey("chargers.id"), nullable=False)
    day_of_week = Column(Integer, nullable=False) # 0=Monday, 6=Sunday
    start_time = Column(String(10), nullable=False) # e.g. "08:00"
    end_time = Column(String(10), nullable=False) # e.g. "22:00"

    charger = relationship("Charger", back_populates="availability_rules")


class AvailabilityBlock(Base):
    __tablename__ = "availability_blocks"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    charger_id = Column(String, ForeignKey("chargers.id"), nullable=False)
    start_ts = Column(DateTime, nullable=False)
    end_ts = Column(DateTime, nullable=False)
    reason = Column(String(200), default="Host personal use")

    charger = relationship("Charger", back_populates="availability_blocks")


class Booking(Base):
    __tablename__ = "bookings"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    driver_id = Column(String, ForeignKey("users.id"), nullable=False)
    charger_id = Column(String, ForeignKey("chargers.id"), nullable=False)
    vehicle_id = Column(String, ForeignKey("vehicles.id"), nullable=False)
    
    # Slot range
    start_time = Column(DateTime, nullable=False, index=True)
    end_time = Column(DateTime, nullable=False, index=True)
    
    # State machine: pending, confirmed, active, completed, cancelled_by_driver, cancelled_by_host, expired, no_show, disputed
    status = Column(String(30), default="pending", index=True)
    requested_kwh = Column(Float, default=15.0)
    
    # Money in paise
    est_energy_cost_paise = Column(Integer, default=0)
    est_fees_paise = Column(Integer, default=0)
    est_tax_paise = Column(Integer, default=0)
    est_total_paise = Column(Integer, default=0)
    
    is_emergency = Column(Boolean, default=False)
    replaced_booking_id = Column(String, nullable=True)
    cancelled_by = Column(String, nullable=True) # driver, host, admin, system
    cancel_reason = Column(String(255), nullable=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    driver = relationship("User", foreign_keys=[driver_id], back_populates="bookings")
    charger = relationship("Charger", back_populates="bookings")
    vehicle = relationship("Vehicle", back_populates="bookings")
    events = relationship("BookingEvent", back_populates="booking", cascade="all, delete-orphan")
    session = relationship("ChargingSession", back_populates="booking", uselist=False)
    review = relationship("Review", back_populates="booking", uselist=False)


class BookingEvent(Base):
    __tablename__ = "booking_events"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    booking_id = Column(String, ForeignKey("bookings.id"), nullable=False)
    type = Column(String(50), nullable=False) # e.g. CREATED, CONFIRMED, STARTED, CANCELLED
    actor_id = Column(String, nullable=False)
    payload = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)

    booking = relationship("Booking", back_populates="events")


class ChargingSession(Base):
    __tablename__ = "charging_sessions"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    booking_id = Column(String, ForeignKey("bookings.id"), unique=True, nullable=False)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    energy_kwh = Column(Float, default=0.0)
    final_cost_paise = Column(Integer, default=0)
    simulated = Column(Boolean, default=True)

    booking = relationship("Booking", back_populates="session")


class Payment(Base):
    __tablename__ = "payments"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    booking_id = Column(String, ForeignKey("bookings.id"), nullable=False)
    provider = Column(String(50), default="mock")
    provider_ref = Column(String(100), default=generate_uuid)
    amount_paise = Column(Integer, nullable=False)
    status = Column(String(20), default="authorized") # created, authorized, captured, refunded, failed
    simulated = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Payout(Base):
    __tablename__ = "payouts"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    host_id = Column(String, ForeignKey("users.id"), nullable=False)
    amount_paise = Column(Integer, nullable=False)
    period = Column(String(50), default="Nov 2026")
    status = Column(String(20), default="completed") # pending, completed, simulated
    created_at = Column(DateTime, default=datetime.utcnow)


class AlternativeOffer(Base):
    __tablename__ = "alternative_offers"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    original_booking_id = Column(String, ForeignKey("bookings.id"), nullable=False)
    charger_id = Column(String, ForeignKey("chargers.id"), nullable=False)
    rank = Column(Integer, default=1)
    score = Column(Float, default=0.0)
    eta_minutes = Column(Float, default=0.0)
    est_total_paise = Column(Integer, default=0)
    status = Column(String(20), default="offered") # offered, accepted, declined, expired
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Review(Base):
    __tablename__ = "reviews"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    booking_id = Column(String, ForeignKey("bookings.id"), unique=True, nullable=False)
    reviewer_id = Column(String, ForeignKey("users.id"), nullable=False)
    charger_id = Column(String, ForeignKey("chargers.id"), nullable=False)
    rating = Column(Integer, nullable=False) # 1 to 5
    comment = Column(Text, default="")
    host_reply = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    booking = relationship("Booking", back_populates="review")
    charger = relationship("Charger", back_populates="reviews")


class VerificationRequest(Base):
    __tablename__ = "verification_requests"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    subject_type = Column(String(20), nullable=False) # user, charger
    subject_id = Column(String, nullable=False)
    level = Column(Integer, nullable=False) # 1, 2, 3, 4
    documents = Column(JSON, default=[])
    status = Column(String(20), default="pending") # pending, approved, rejected
    reviewer_id = Column(String, nullable=True)
    note = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class Report(Base):
    __tablename__ = "reports"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    reporter_id = Column(String, ForeignKey("users.id"), nullable=False)
    charger_id = Column(String, ForeignKey("chargers.id"), nullable=False)
    reason = Column(String(100), nullable=False)
    details = Column(Text, default="")
    status = Column(String(20), default="open") # open, investigating, resolved, dismissed
    resolution = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    type = Column(String(50), nullable=False)
    title = Column(String(150), nullable=False)
    body = Column(Text, nullable=False)
    data = Column(JSON, default={})
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")


class RecommendationLog(Base):
    __tablename__ = "recommendation_logs"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, nullable=True)
    request = Column(JSON, nullable=False)
    results = Column(JSON, nullable=False)
    algorithm_version = Column(String(20), default="v1.0-rules")
    latency_ms = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    actor_id = Column(String, nullable=False)
    action = Column(String(100), nullable=False)
    entity = Column(String(50), nullable=False)
    entity_id = Column(String, nullable=False)
    payload = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
