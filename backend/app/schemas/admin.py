"""Admin schemas: listing, statistics, invitations, audit."""

from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.registration import RegistrationFull, SpouseBrief


class RegistrationListResponse(BaseModel):
    items: List[RegistrationFull]
    total: int
    page: int
    per_page: int
    pages: int


class StatusUpdate(BaseModel):
    status: Literal["registered", "checked_in", "cancelled"]


class StatsResponse(BaseModel):
    total: int
    checked_in: int
    cancelled: int
    male: int
    female: int
    single: int
    married: int
    linked_pairs: int
    pending_invites: int
    by_day: List[dict]
    by_occupation: List[dict]


class AdminInviteItem(BaseModel):
    token: str
    status: str
    expires_at: datetime
    created_at: datetime
    inviter: str
    inviter_registration_id: str
    accepted_by: Optional[str] = None
    invite_url: str


class AuditItem(BaseModel):
    at: datetime
    action: str
    target: Optional[str] = None
    by: Optional[str] = None


class DeleteResponse(BaseModel):
    ok: bool = True
