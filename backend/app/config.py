import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "ChargeNeighbor API"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./chargeneighbor.db")
    
    # Security
    JWT_SECRET: str = os.getenv("JWT_SECRET", "super-secret-chargeneighbor-token-key-2026")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_MINUTES: int = int(os.getenv("ACCESS_TOKEN_MINUTES", "15"))
    REFRESH_TOKEN_DAYS: int = int(os.getenv("REFRESH_TOKEN_DAYS", "7"))
    
    # Integrations
    OSRM_BASE_URL: str = os.getenv("OSRM_BASE_URL", "https://router.project-osrm.org")
    PAYMENT_PROVIDER: str = os.getenv("PAYMENT_PROVIDER", "mock")
    OTP_PROVIDER: str = os.getenv("OTP_PROVIDER", "mock")
    EMAIL_BACKEND: str = os.getenv("EMAIL_BACKEND", "console")
    STORAGE_BACKEND: str = os.getenv("STORAGE_BACKEND", "local")
    
    # Business logic & Fees
    PLATFORM_FEE_PCT: float = float(os.getenv("PLATFORM_FEE_PCT", "0.10")) # 10%
    PLATFORM_MIN_FEE_PAISE: int = int(os.getenv("PLATFORM_MIN_FEE_PAISE", "2000")) # ₹20
    TAX_PCT: float = float(os.getenv("TAX_PCT", "0.18")) # 18% GST
    SAFETY_MARGIN: float = float(os.getenv("SAFETY_MARGIN", "0.20")) # 20%
    
    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"]
    
    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
