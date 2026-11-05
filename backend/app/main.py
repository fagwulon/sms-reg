"""SMS Summit 2026 — Registration API (FastAPI entrypoint).

Run locally:  uvicorn app.main:app --reload
Swagger UI:   http://localhost:8000/docs
"""

from __future__ import annotations

import logging

from alembic.config import Config as AlembicConfig
from alembic import command as alembic_command
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.schemas.common import ApiError, error_body

logger = logging.getLogger(__name__)

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description=(
        "Backend for the Singles & Married Summit 2026 registration platform. "
        "See sms-frontend/frontend/docs/API-CONTRACT.md for the shared contract."
    ),
)


@app.on_event("startup")
def on_startup():
    """Run Alembic migrations on startup to ensure the database is up to date."""
    logger.info("Running database migrations on startup...")
    import os
    alembic_cfg = AlembicConfig(os.path.join(os.path.dirname(os.path.dirname(__file__)), "alembic.ini"))
    alembic_cfg.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
    alembic_command.upgrade(alembic_cfg, "head")
    logger.info("Database migrations completed.")

# --- CORS (origins come from .env, never hardcoded) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


# --- Error envelope: {"detail": {code, message, fields}} ---

@app.exception_handler(ApiError)
async def api_error_handler(request: Request, exc: ApiError):
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(exc.code, exc.message, exc.fields),
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    fields: dict[str, str] = {}
    for err in exc.errors():
        loc = err.get("loc", [])
        key = str(loc[-1]) if loc and isinstance(loc[-1], str) else "form"
        fields[key] = err.get("msg", "Invalid value.")
    return JSONResponse(
        status_code=422,
        content=error_body("validation_error", "Please correct the highlighted fields.", fields),
    )


# --- Routers ---
from app.api.v1 import admin, auth, registrations, spouse_invitations  # noqa: E402

app.include_router(registrations.router, prefix=settings.API_V1_PREFIX)
app.include_router(spouse_invitations.router, prefix=settings.API_V1_PREFIX)
app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(admin.router, prefix=settings.API_V1_PREFIX)


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME}


@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "docs": "/docs",
        "api_prefix": settings.API_V1_PREFIX,
    }
