"""Organizer authentication endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Request
from sqlalchemy import select

from app.core.deps import CurrentOrganizer, DBDep
from app.core.security import create_access_token, verify_password
from app.models import Organizer
from app.schemas.auth import (
    LoginRequest,
    LogoutResponse,
    MeResponse,
    SessionResponse,
)
from app.schemas.common import ApiError
from app.services.rate_limit import rate_limit

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=SessionResponse)
def login(payload: LoginRequest, request: Request, db: DBDep):
    rate_limit(request, "login")
    organizer = db.execute(
        select(Organizer).where(Organizer.email == payload.email.strip().lower())
    ).scalar_one_or_none()
    if not organizer or not verify_password(payload.password, organizer.password_hash):
        raise ApiError(401, "not_authenticated", "Invalid email or password.")
    if not organizer.is_active:
        raise ApiError(401, "not_authenticated", "This account has been disabled.")
    token, expires_at = create_access_token(
        subject=str(organizer.id), role=organizer.role,
        name=organizer.full_name, email=organizer.email,
    )
    return SessionResponse(
        token=token, role=organizer.role, name=organizer.full_name,
        email=organizer.email, expires_at=expires_at,
    )


@router.get("/me", response_model=MeResponse)
def me(organizer: CurrentOrganizer):
    return MeResponse(role=organizer.role, name=organizer.full_name, email=organizer.email)


@router.post("/logout", response_model=LogoutResponse)
def logout(organizer: CurrentOrganizer):
    # JWTs are stateless; the frontend clears the token. Endpoint exists so the
    # client has a well-defined call to make.
    return LogoutResponse(ok=True)
