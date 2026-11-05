"""Application configuration loaded from environment variables.

Secrets (DATABASE_URL, SECRET_KEY, ...) must NEVER be committed to git.
See .env.example for the full list of expected variables.
"""

from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_file_mode="merge",
        extra="ignore",
    )

    APP_NAME: str = "SMS Summit 2026 Registration API"
    APP_ENV: str = "development"
    API_V1_PREFIX: str = "/api/v1"

    # PostgreSQL (Supabase) — required; no fallback to SQLite.
    # Format: postgresql+psycopg://user:pass@host:6543/db
    DATABASE_URL: str

    # Auth — must be changed from default before running.
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_HOURS: int = 8

    # CORS — comma separated list of allowed origins
    CORS_ORIGINS: str = "https://smssummit26.com"

    # Public app URL used to build invitation links
    APP_URL: str = "https://smssummit26.com"

    # Spouse invitation settings
    INVITE_TTL_HOURS: int = 48

    # Abuse protection for sensitive public endpoints
    RATE_LIMIT_PER_MINUTE: int = 20

    # QR payload prefix, e.g. "SMS26|SMS26-XXXX-0001"
    QR_PREFIX: str = "SMS26"

    # Database connection pool settings (optimized for Render free tier: 512MB RAM)
    DB_POOL_SIZE: int = 2
    DB_MAX_OVERFLOW: int = 1
    DB_POOL_RECYCLE: int = 300  # seconds — recycle before server-side timeout
    DB_POOL_TIMEOUT: int = 10

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_must_not_be_default(cls, v: str) -> str:
        if v == "change-me-in-production":
            raise ValueError(
                "SECRET_KEY must be set to a random value. "
                "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
            )
        return v

    @field_validator("DATABASE_URL")
    @classmethod
    def database_must_be_postgres(cls, v: str) -> str:
        if not v.startswith("postgresql"):
            raise ValueError(
                "DATABASE_URL must be a PostgreSQL connection string. "
                "SQLite is not supported in production."
            )
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
