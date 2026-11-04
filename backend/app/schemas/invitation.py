"""Spouse invitation schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional, Union

from pydantic import BaseModel, Field

from app.schemas.registration import RegistrationCreate, RegistrationPublic, SpouseBrief


class InviteCreate(BaseModel):
    registration_id: str = Field(min_length=3, max_length=32)


class InviterPublic(BaseModel):
    full_name: str
    gender: str
    marital_status: str
    registration_id: str


class InvitePreview(BaseModel):
    token: str
    status: str
    expires_at: datetime
    inviter: InviterPublic
    accepted_by: Optional[str] = None
    can_accept: bool


class AcceptExisting(BaseModel):
    mode: Literal["existing"] = "existing"
    registration_id: str = Field(min_length=3, max_length=32)


class AcceptNew(BaseModel):
    mode: Literal["new"] = "new"
    registration: RegistrationCreate


class AcceptInviteRequest(BaseModel):
    mode: Literal["existing", "new"]
    registration_id: Optional[str] = Field(default=None, min_length=3, max_length=32)
    registration: Optional[RegistrationCreate] = None


class AcceptInviteResponse(BaseModel):
    message: str = "Spouse linked successfully."
    registration: RegistrationPublic
    spouse: SpouseBrief


class RevokeInviteResponse(BaseModel):
    token: str
    status: str = "revoked"
