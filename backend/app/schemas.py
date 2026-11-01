from typing import List, Optional
from pydantic import BaseModel, Field

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict

class RegisterRequest(BaseModel):
    name: str
    email: str
    phone: str
    password: str
    role: str = "driver" # driver or host

class LoginRequest(BaseModel):
    email: str
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str

class OTPVerifyRequest(BaseModel):
    otp: str

class PasswordForgotRequest(BaseModel):
    email: str

class PasswordResetRequest(BaseModel):
    token: str
    new_password: str

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    timezone: Optional[str] = None

class VehicleCreate(BaseModel):
    make: str
    model: str
    year: int
    battery_kwh: float
    usable_battery_pct: float = 95.0
    efficiency_km_per_kwh: float
    connector_types: List[str]
    max_ac_kw: float = 7.4
    max_dc_kw: float = 50.0
    is_default: bool = False

class ChargerCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    address: str
    city: str = "Bengaluru"
    latitude: float
    longitude: float
    connector_type: str # Type2, CCS2, etc.
    current_type: str = "AC"
    power_kw: float
    price_per_kwh_paise: int
    time_fee_per_hour_paise: int = 0
    idle_fee_per_hour_paise: int = 0
    min_session_minutes: int = 30
    booking_mode: str = "instant"
    access_instructions: Optional[str] = ""
    photos: List[str] = []

class AvailabilityRuleInput(BaseModel):
    day_of_week: int
    start_time: str
    end_time: str

class AvailabilityBlockInput(BaseModel):
    start_ts: str
    end_ts: str
    reason: Optional[str] = "Host personal block"

class RecommendationRequest(BaseModel):
    vehicle_id: Optional[str] = None
    battery_pct: float = Field(..., ge=1, le=100)
    current_lat: float
    current_lng: float
    desired_start: Optional[str] = None
    duration_hours: Optional[float] = 1.0
    target_pct: Optional[float] = 80.0
    priority: str = "balanced" # fastest, cheapest, safest, balanced
    emergency: bool = False
    radius_km: float = 15.0

class BookingCreate(BaseModel):
    charger_id: str
    vehicle_id: str
    start_time: str
    end_time: str
    requested_kwh: float = 15.0
    is_emergency: bool = False

class ReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: str = ""

class ReviewReply(BaseModel):
    reply: str

class VerificationSubmit(BaseModel):
    level: int
    documents: List[str]
    note: Optional[str] = ""

class ReportCreate(BaseModel):
    reason: str
    details: Optional[str] = ""

class DisputeCreate(BaseModel):
    reason: str
    details: Optional[str] = ""
