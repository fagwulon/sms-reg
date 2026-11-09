"""Spouse invitation creation, preview, acceptance and revocation.

Security rules enforced here (all inside a single DB transaction where the
state changes):
- tokens are cryptographically random; both raw token and SHA-256 hash are stored
- the hash is used for verification; the raw token is stored so invite URLs
  can be reconstructed when the attendee views their registration
- invitations expire (TTL from INVITE_TTL_HOURS)
- an invitation can be accepted at most once
- self-linking is impossible
- each attendee can have only one active spouse relationship
- linking never merges records — both registrations stay independent
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import generate_invitation_token, hash_token
from app.models import Attendee, SpouseInvitation, SpouseRelationship
from app.schemas.common import ApiError
from app.services.registration_service import (
    create_attendee,
    find_by_registration_id,
)

settings = get_settings()


def invite_url(token: str) -> str:
    return f"{settings.APP_URL.rstrip('/')}/invite.html?token={token}"


def get_invitation_by_token(db: Session, token: str) -> SpouseInvitation | None:
    th = hash_token(token.strip())
    return db.execute(
        select(SpouseInvitation).where(SpouseInvitation.token_hash == th)
    ).scalar_one_or_none()


def _mark_expired_if_needed(inv: SpouseInvitation) -> None:
    if (
        inv.status == "pending"
        and inv.expires_at.replace(tzinfo=timezone.utc) <= datetime.now(timezone.utc)
    ):
        inv.status = "expired"


def create_invitation(db: Session, registration_id: str) -> tuple[SpouseInvitation, str]:
    inviter = find_by_registration_id(db, registration_id)
    if not inviter:
        raise ApiError(404, "not_found", "Registration not found.",
                       fields={"registration_id": "Registration not found."})
    if inviter.spouse_id is not None:
        raise ApiError(409, "already_linked", "This registration already has a linked spouse.")

    existing = db.execute(
        select(SpouseInvitation)
        .where(SpouseInvitation.inviter_id == inviter.id)
        .where(SpouseInvitation.status == "pending")
        .order_by(SpouseInvitation.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if existing and existing.expires_at.replace(tzinfo=timezone.utc) > now:
        # Revoke the old pending invite and create a new one.
        existing.status = "revoked"
        db.flush()

    token = generate_invitation_token()
    inv = SpouseInvitation(
        id=uuid.uuid4(),
        inviter_id=inviter.id,
        token=token,
        token_hash=hash_token(token),
        status="pending",
        expires_at=now + timedelta(hours=settings.INVITE_TTL_HOURS),
    )
    db.add(inv)
    db.flush()
    return inv, token


def accept_invitation(db: Session, token: str, payload) -> tuple[Attendee, Attendee]:
    """Accept an invitation. Returns (accepting_attendee, inviter)."""
    inv = get_invitation_by_token(db, token)
    if not inv:
        raise ApiError(404, "not_found", "Invitation not found.")

    _mark_expired_if_needed(inv)
    if inv.status == "expired":
        db.flush()
        raise ApiError(410, "invite_expired", "This invitation has expired.")
    if inv.status == "revoked":
        raise ApiError(410, "invite_expired", "This invitation has been revoked.")
    if inv.status == "accepted":
        raise ApiError(409, "already_accepted", "This invitation has already been used.")

    inviter = db.get(Attendee, inv.inviter_id)
    if not inviter:
        raise ApiError(404, "not_found", "Inviter registration not found.")

    # Resolve the accepting attendee (existing record or brand-new registration).
    if payload.mode == "existing":
        if not payload.registration_id:
            raise ApiError(422, "validation_error", "registration_id is required.",
                           fields={"registration_id": "Registration ID is required."})
        accepter = find_by_registration_id(db, payload.registration_id)
        if not accepter:
            raise ApiError(404, "not_found", "Registration not found.",
                           fields={"registration_id": "Registration not found."})
    else:
        if payload.registration is None:
            raise ApiError(422, "validation_error", "registration payload is required.",
                           fields={"registration": "Registration details are required."})
        accepter = create_attendee(db, payload.registration)

    # --- relationship rules ---
    if accepter.id == inviter.id:
        raise ApiError(409, "self_link", "You cannot link a registration to itself.")
    if accepter.gender == inviter.gender:
        raise ApiError(409, "gender_mismatch",
                       "Spouse links must be between a male and a female registration.")
    if inviter.spouse_id is not None or accepter.spouse_id is not None:
        raise ApiError(409, "already_linked", "One of the registrations already has a linked spouse.")

    # --- all checks passed: establish the link atomically ---
    inviter.spouse_id = accepter.id
    accepter.spouse_id = inviter.id
    inv.status = "accepted"
    inv.accepted_by = accepter.id
    inv.accepted_at = datetime.now(timezone.utc)
    db.add(
        SpouseRelationship(
            id=uuid.uuid4(),
            attendee_one_id=inviter.id,
            attendee_two_id=accepter.id,
            invitation_id=inv.id,
        )
    )
    db.flush()
    return accepter, inviter


def revoke_invitation(db: Session, token: str) -> SpouseInvitation:
    inv = get_invitation_by_token(db, token)
    if not inv:
        raise ApiError(404, "not_found", "Invitation not found.")
    if inv.status == "accepted":
        raise ApiError(409, "already_accepted", "This invitation has already been used.")
    _mark_expired_if_needed(inv)
    if inv.status == "expired":
        db.flush()
        raise ApiError(410, "invite_expired", "This invitation has expired.")
    inv.status = "revoked"
    db.flush()
    return inv
