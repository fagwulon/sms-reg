"""Registration request/response schemas (must match frontend API-CONTRACT.md)."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

PHONE_RE = re.compile(r"^\+?[0-9][0-9 \-()]{6,19}$")


class RegistrationCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    phone: str = Field(min_length=7, max_length=25)
    gender: Literal["male", "female"]
    marital_status: Literal["single", "married"]
    occupation: Optional[str] = Field(default=None, max_length=120)
    age_range: Optional[str] = Field(default=None, max_length=20)
    city: Optional[str] = Field(default=None, max_length=120)
    expectations: Optional[str] = Field(default=None, max_length=2000)
    emergency_contact_name: Optional[str] = Field(default=None, max_length=200)
    emergency_contact_phone: Optional[str] = Field(default=None, max_length=25)
    wants_spouse_invite: bool = False

    @field_validator("full_name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Full name is required.")
        return v.strip()

    @field_validator("phone")
    @classmethod
    def phone_valid(cls, v: str) -> str:
        v = v.strip()
        if not PHONE_RE.match(v):
            raise ValueError("Enter a valid phone number.")
        return v

    @field_validator("emergency_contact_phone")
    @classmethod
    def emergency_phone_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v.strip() == "":
            return None
        v = v.strip()
        if not PHONE_RE.match(v):
            raise ValueError("Enter a valid emergency contact phone number.")
        return v

    @field_validator(
        "occupation", "age_range", "city", "expectations",
        "emergency_contact_name", mode="before",
    )
    @classmethod
    def empty_to_none(cls, v):
        if isinstance(v, str) and v.strip() == "":
            return None
        return v


class SpouseBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    registration_id: str
    full_name: str


class PendingInviteBrief(BaseModel):
    token: str
    expires_at: datetime
    invite_url: str


class RegistrationPublic(BaseModel):
    """Safe public view — never includes expectations / emergency contacts."""

    id: str
    registration_id: str
    full_name: str
    status: str
    qr_payload: str
    spouse: Optional[SpouseBrief] = None
    pending_invite: Optional[PendingInviteBrief] = None

    @classmethod
    def from_model(cls, a, pending_invite: Optional[PendingInviteBrief] = None) -> "RegistrationPublic":
        return cls(
            id=f"reg_{a.id.hex[:6]}",
            registration_id=a.registration_id,
            full_name=a.full_name,
            status=a.status,
            qr_payload=a.qr_identifier,
            spouse=(
                SpouseBrief(
                    id=f"reg_{a.spouse.id.hex[:6]}",
                    registration_id=a.spouse.registration_id,
                    full_name=a.spouse.full_name,
                )
                if a.spouse
                else None
            ),
            pending_invite=pending_invite,
        )


class RegistrationFull(RegistrationPublic):
    """Admin view — includes all fields."""

    email: str
    phone: str
    gender: str
    marital_status: str
    occupation: Optional[str] = None
    age_range: Optional[str] = None
    city: Optional[str] = None
    expectations: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    invite_accepted: bool = False


class InviteOut(BaseModel):
    token: str
    status: str
    expires_at: datetime
    invite_url: str


class RegistrationCreatedResponse(BaseModel):
    registration: RegistrationPublic
    spouse_invite: Optional[InviteOut] = None
    message: str = "Registration successful."


class ConfirmationResponse(BaseModel):
    registration_id: str
    full_name: str
    status: str
    qr_payload: str
    message: str = "Registration confirmed."
