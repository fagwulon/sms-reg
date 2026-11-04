"""Organizer auth schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SessionResponse(BaseModel):
    token: str
    role: str
    name: str
    email: str
    expires_at: datetime


class MeResponse(BaseModel):
    role: str
    name: str
    email: str
    expires_at: Optional[datetime] = None


class LogoutResponse(BaseModel):
    ok: bool = True


class QRVerifyRequest(BaseModel):
    qr_payload: str


class QRVerifyResponse(BaseModel):
    valid: bool
    registration_id: Optional[str] = None
    full_name: Optional[str] = None
    status: Optional[str] = None
    message: str
