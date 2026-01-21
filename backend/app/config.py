"""Application configuration loaded from environment variables."""

from __future__ import annotations
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    # Database
    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/locksmith"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Twilio
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""

    # Stripe
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    # Google Maps
    google_maps_api_key: str = ""

    # App Settings
    app_env: str = "development"
    base_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"

    # Dispatch Settings
    dispatch_wave_size: int = 3
    dispatch_wave_delay_seconds: int = 120

    # Service Areas (cities we operate in)
    # Can be overridden via SERVICE_AREAS env var (comma-separated)
    service_areas: list[str] = ["San Francisco", "Oakland", "San Jose", "Laredo"]

    # Deposit amounts by service type (in cents)
    deposit_amounts: dict[str, int] = {
        "home_lockout": 4900,  # $49
        "car_lockout": 5900,   # $59
        "rekey": 7900,         # $79
        "smart_lock": 9900,    # $99
    }

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
