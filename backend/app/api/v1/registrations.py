"""Public registration endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response

from app.core.deps import DBDep
from app.db.transactions import transaction
from app.models import Attendee
from app.schemas.common import ApiError
from app.schemas.registration import (
    ConfirmationResponse,
    InviteOut,
    PendingInviteBrief,
    RegistrationCreate,
    RegistrationCreatedResponse,
    RegistrationPublic,
)
from app.services import invitation_service, registration_service
from app.services.qr_service import qr_png_bytes
from app.services.rate_limit import rate_limit

router = APIRouter(prefix="/registrations", tags=["registrations"])


def _pending_invite_brief(db, attendee: Attendee):
    inv = registration_service.get_pending_invite(db, attendee.id)
    if not inv or not inv.token:
        return None
    return PendingInviteBrief(
        token=inv.token,
        expires_at=inv.expires_at,
        invite_url=invitation_service.invite_url(inv.token),
    )


@router.post("", response_model=RegistrationCreatedResponse, status_code=201)
def register(payload: RegistrationCreate, request: Request, db: DBDep):
    rate_limit(request, "register")
    with transaction(db):
        attendee = registration_service.create_attendee(db, payload)
        spouse_invite = None
        if payload.wants_spouse_invite and payload.marital_status == "married":
            inv, token = invitation_service.create_invitation(db, attendee.registration_id)
            spouse_invite = InviteOut(
                token=token,
                status=inv.status,
                expires_at=inv.expires_at,
                invite_url=invitation_service.invite_url(token),
            )
    db.refresh(attendee)
    return RegistrationCreatedResponse(
        registration=RegistrationPublic.from_model(attendee),
        spouse_invite=spouse_invite,
    )


@router.get("/{registration_id}", response_model=RegistrationPublic)
def get_registration(registration_id: str, db: DBDep):
    attendee = registration_service.find_by_registration_id(db, registration_id)
    if not attendee:
        raise ApiError(404, "not_found", "Registration not found.")
    pending = _pending_invite_brief(db, attendee)
    return RegistrationPublic.from_model(attendee, pending_invite=pending)


@router.get("/{registration_id}/confirmation", response_model=ConfirmationResponse)
def get_confirmation(registration_id: str, db: DBDep):
    attendee = registration_service.find_by_registration_id(db, registration_id)
    if not attendee:
        raise ApiError(404, "not_found", "Registration not found.")
    return ConfirmationResponse(
        registration_id=attendee.registration_id,
        full_name=attendee.full_name,
        status=attendee.status,
        qr_payload=attendee.qr_identifier,
    )


@router.post("/{registration_id}/checkin", response_model=RegistrationPublic)
def check_in(registration_id: str, db: DBDep):
    attendee = registration_service.find_by_registration_id(db, registration_id)
    if not attendee:
        raise ApiError(404, "not_found", "Registration not found.")
    with transaction(db):
        if attendee.status == "cancelled":
            raise ApiError(409, "cancelled", "This registration has been cancelled.")
        if attendee.status != "checked_in":
            attendee.status = "checked_in"
    db.refresh(attendee)
    return RegistrationPublic.from_model(attendee)


@router.get("/{registration_id}/qr.png")
def qr_png(registration_id: str, db: DBDep):
    attendee = registration_service.find_by_registration_id(db, registration_id)
    if not attendee:
        raise ApiError(404, "not_found", "Registration not found.")
    return Response(content=qr_png_bytes(attendee.qr_identifier),
                    media_type="image/png")
