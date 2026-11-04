"""Spouse invitation endpoints (public, token-scoped)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.core.deps import DBDep
from app.db.transactions import transaction
from app.schemas.common import ApiError
from app.schemas.invitation import (
    AcceptInviteRequest,
    AcceptInviteResponse,
    InviteCreate,
    InvitePreview,
    InviterPublic,
    RevokeInviteResponse,
)
from app.schemas.registration import InviteOut, RegistrationPublic, SpouseBrief
from app.services import invitation_service
from app.services.rate_limit import rate_limit

router = APIRouter(prefix="/spouse-invitations", tags=["spouse-invitations"])


@router.post("", response_model=InviteOut, status_code=201)
def create_invite(payload: InviteCreate, request: Request, db: DBDep):
    rate_limit(request, "invite")
    with transaction(db):
        inv, token = invitation_service.create_invitation(db, payload.registration_id)
    return InviteOut(
        token=token,
        status=inv.status,
        expires_at=inv.expires_at,
        invite_url=invitation_service.invite_url(token),
    )


@router.get("/{token}", response_model=InvitePreview)
def preview_invite(token: str, db: DBDep):
    inv = invitation_service.get_invitation_by_token(db, token)
    if not inv:
        raise ApiError(404, "not_found", "Invitation not found.")
    invitation_service._mark_expired_if_needed(inv)
    db.flush()
    inviter = inv.inviter
    accepter_name = inv.accepted_by_attendee.full_name if inv.accepted_by_attendee else None
    can_accept = inv.status == "pending"
    return InvitePreview(
        token=token,
        status=inv.status,
        expires_at=inv.expires_at,
        inviter=InviterPublic(
            full_name=inviter.full_name,
            gender=inviter.gender,
            marital_status=inviter.marital_status,
            registration_id=inviter.registration_id,
        ),
        accepted_by=accepter_name,
        can_accept=can_accept,
    )


@router.post("/{token}/accept", response_model=AcceptInviteResponse)
def accept_invite(token: str, payload: AcceptInviteRequest, request: Request, db: DBDep):
    rate_limit(request, "accept")
    with transaction(db):
        accepter, inviter = invitation_service.accept_invitation(db, token, payload)
    db.refresh(accepter)
    db.refresh(inviter)
    return AcceptInviteResponse(
        registration=RegistrationPublic.from_model(accepter),
        spouse=SpouseBrief(
            id=f"reg_{inviter.id.hex[:6]}",
            registration_id=inviter.registration_id,
            full_name=inviter.full_name,
        ),
    )


@router.delete("/{token}", response_model=RevokeInviteResponse)
def revoke_invite(token: str, db: DBDep):
    with transaction(db):
        inv = invitation_service.revoke_invitation(db, token)
    return RevokeInviteResponse(token=token, status=inv.status)
