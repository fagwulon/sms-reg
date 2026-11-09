"""Registration business logic."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import generate_registration_code_part
from app.models import Attendee, SpouseInvitation
from app.schemas.common import ApiError

settings = get_settings()


def _qr_payload(registration_id: str) -> str:
    return f"{settings.QR_PREFIX}|{registration_id}"


def generate_registration_id(db: Session) -> str:
    """SMS26-XXXXXXXX — 8 random chars from an unambiguous alphabet.

    Uses a purely random ID to avoid the expensive COUNT(*) query on every
    registration. Collision probability is negligible (30^8 ≈ 6.5×10^11).
    """
    for _ in range(5):
        candidate = f"SMS26-{generate_registration_code_part()}{generate_registration_code_part()}"
        exists = db.execute(
            select(Attendee.id).where(Attendee.registration_id == candidate)
        ).first()
        if not exists:
            return candidate
    raise ApiError(500, "internal_error", "Could not allocate a registration ID.")


def find_by_registration_id(db: Session, registration_id: str) -> Attendee | None:
    rid = registration_id.strip().upper()
    from sqlalchemy import func
    return db.execute(
        select(Attendee).where(func.upper(Attendee.registration_id) == rid)
    ).scalar_one_or_none()


def find_by_email(db: Session, email: str) -> Attendee | None:
    return db.execute(
        select(Attendee).where(Attendee.email_lower == email.strip().lower())
    ).scalar_one_or_none()


def create_attendee(db: Session, data) -> Attendee:
    email = data.email.strip().lower()
    if find_by_email(db, email):
        raise ApiError(409, "duplicate_email", "This email is already registered.",
                       fields={"email": "This email is already registered."})

    attendee = Attendee(
        id=uuid.uuid4(),
        registration_id=generate_registration_id(db),
        full_name=data.full_name,
        email=email,
        email_lower=email,
        phone=data.phone,
        gender=data.gender,
        marital_status=data.marital_status,
        occupation=data.occupation,
        age_range=data.age_range,
        city=data.city,
        expectations=data.expectations,
        emergency_contact_name=data.emergency_contact_name,
        emergency_contact_phone=data.emergency_contact_phone,
        status="registered",
    )
    attendee.qr_identifier = _qr_payload(attendee.registration_id)
    db.add(attendee)
    db.flush()
    return attendee


def get_pending_invite(db: Session, attendee_id: uuid.UUID) -> SpouseInvitation | None:
    from datetime import datetime, timezone

    return db.execute(
        select(SpouseInvitation)
        .where(SpouseInvitation.inviter_id == attendee_id)
        .where(SpouseInvitation.status == "pending")
        .where(SpouseInvitation.expires_at > datetime.now(timezone.utc))
        .order_by(SpouseInvitation.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()


def is_linked(db: Session, attendee: Attendee) -> bool:
    return attendee.spouse_id is not None
