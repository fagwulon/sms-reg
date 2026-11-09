"""Organizer (admin) management endpoints — all require a Bearer token."""

from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query, Response
from sqlalchemy import String, func, or_, select

from app.core.deps import AdminOnly, CurrentOrganizer, DBDep, StaffOnly
from app.db.transactions import transaction
from app.models import Attendee, AuditLog, SpouseInvitation, SpouseRelationship
from app.schemas.admin import (
    AdminInviteItem,
    AuditItem,
    DeleteResponse,
    RegistrationListResponse,
    StatsResponse,
    StatusUpdate,
)
from app.schemas.auth import QRVerifyRequest, QRVerifyResponse
from app.schemas.common import ApiError
from app.schemas.registration import RegistrationFull, SpouseBrief
from app.services import invitation_service, registration_service

router = APIRouter(prefix="/admin", tags=["admin"])


def _full(a: Attendee, db) -> RegistrationFull:
    invite_accepted = (
        db.execute(
            select(func.count())
            .select_from(SpouseInvitation)
            .where(SpouseInvitation.accepted_by == a.id)
        ).scalar()
        > 0
    )
    return RegistrationFull(
        id=f"reg_{a.id.hex[:6]}",
        registration_id=a.registration_id,
        full_name=a.full_name,
        email=a.email,
        phone=a.phone,
        gender=a.gender,
        marital_status=a.marital_status,
        occupation=a.occupation,
        age_range=a.age_range,
        city=a.city,
        expectations=a.expectations,
        emergency_contact_name=a.emergency_contact_name,
        emergency_contact_phone=a.emergency_contact_phone,
        status=a.status,
        qr_payload=a.qr_identifier,
        created_at=a.created_at,
        updated_at=a.updated_at,
        spouse=(
            SpouseBrief(
                id=f"reg_{a.spouse.id.hex[:6]}",
                registration_id=a.spouse.registration_id,
                full_name=a.spouse.full_name,
            )
            if a.spouse
            else None
        ),
        invite_accepted=bool(invite_accepted),
    )


def _find_attendee(db, identifier: str) -> Attendee:
    """Accept either the internal id (reg_xxxxxx) or the registration_id."""
    identifier = identifier.strip()

    # Try full UUID first
    parsed_uuid = _parse_uuid(identifier)
    if parsed_uuid:
        a = db.execute(
            select(Attendee).where(
                or_(
                    func.upper(Attendee.registration_id) == identifier.upper(),
                    Attendee.id == parsed_uuid,
                )
            )
        ).scalar_one_or_none()
        if a:
            return a

    # Try registration_id (case-insensitive)
    a = db.execute(
        select(Attendee).where(
            func.upper(Attendee.registration_id) == identifier.upper()
        )
    ).scalar_one_or_none()
    if a:
        return a

    # Internal short id: reg_<first 6 hex of uuid>
    # Use a targeted query instead of scanning the full table.
    if identifier.startswith("reg_") and len(identifier) == 10:
        hex_prefix = identifier[4:]  # the 6 hex chars after "reg_"
        # Query attendees whose UUID hex starts with this prefix.
        # Cast UUID to text and match the first 6 hex characters.
        a = db.execute(
            select(Attendee).where(
                func.left(Attendee.id.cast(String), 6) == hex_prefix
            )
        ).scalar_one_or_none()
        if a:
            return a

    raise ApiError(404, "not_found", "Registration not found.")


def _parse_uuid(s: str):
    try:
        return uuid.UUID(s)
    except (ValueError, AttributeError):
        return None


def _audit(db, action: str, target: str | None, by: str | None) -> None:
    db.add(AuditLog(action=action, target=target, by=by))


# NOTE: /registrations/export is declared BEFORE /registrations/{id} so the
# literal path wins over the path parameter.
@router.get("/registrations/export")
def export_csv(db: DBDep, organizer: StaffOnly):
    rows = db.execute(select(Attendee).order_by(Attendee.created_at)).scalars().all()
    buf = io.StringIO()
    writer = csv.writer(buf, quoting=csv.QUOTE_ALL)
    writer.writerow([
        "registration_id", "full_name", "email", "phone", "gender", "marital_status",
        "occupation", "age_range", "city", "status", "spouse_registration_id", "created_at",
    ])
    for a in rows:
        writer.writerow([
            a.registration_id, a.full_name, a.email, a.phone, a.gender, a.marital_status,
            a.occupation or "", a.age_range or "", a.city or "", a.status,
            a.spouse.registration_id if a.spouse else "",
            a.created_at.isoformat(),
        ])
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=sms26-registrations.csv"},
    )


@router.get("/registrations", response_model=RegistrationListResponse)
def list_registrations(
    db: DBDep,
    organizer: StaffOnly,
    q: str | None = Query(default=None),
    gender: str | None = Query(default=None),
    marital_status: str | None = Query(default=None),
    status: str | None = Query(default=None),
    linked: str | None = Query(default=None),
    sort: str = Query(default="created_at"),
    dir: str = Query(default="desc"),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=10, ge=1, le=100),
):
    stmt = select(Attendee)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Attendee.full_name.ilike(like),
                Attendee.email.ilike(like),
                Attendee.phone.ilike(like),
                func.upper(Attendee.registration_id).like(like.upper()),
            )
        )
    if gender in ("male", "female"):
        stmt = stmt.where(Attendee.gender == gender)
    if marital_status in ("single", "married"):
        stmt = stmt.where(Attendee.marital_status == marital_status)
    if status in ("registered", "checked_in", "cancelled"):
        stmt = stmt.where(Attendee.status == status)
    if linked == "yes":
        stmt = stmt.where(Attendee.spouse_id.isnot(None))
    elif linked == "no":
        stmt = stmt.where(Attendee.spouse_id.is_(None))

    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar()

    sort_col = {
        "full_name": Attendee.full_name,
        "registration_id": Attendee.registration_id,
        "created_at": Attendee.created_at,
    }.get(sort, Attendee.created_at)
    stmt = stmt.order_by(sort_col.desc() if dir == "desc" else sort_col.asc())
    stmt = stmt.offset((page - 1) * per_page).limit(per_page)
    items = db.execute(stmt).scalars().all()

    return RegistrationListResponse(
        items=[_full(a, db) for a in items],
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, (total + per_page - 1) // per_page) if total else 1,
    )


@router.get("/registrations/{identifier}", response_model=RegistrationFull)
def get_registration(identifier: str, db: DBDep, organizer: StaffOnly):
    return _full(_find_attendee(db, identifier), db)


@router.patch("/registrations/{identifier}", response_model=RegistrationFull)
def update_status(identifier: str, payload: StatusUpdate, db: DBDep, organizer: StaffOnly):
    with transaction(db):
        a = _find_attendee(db, identifier)
        a.status = payload.status
        _audit(db, f"registration.{payload.status}", a.registration_id, organizer.email)
    db.refresh(a)
    return _full(a, db)


@router.delete("/registrations/{identifier}", response_model=DeleteResponse)
def delete_registration(identifier: str, db: DBDep, organizer: AdminOnly):
    with transaction(db):
        a = _find_attendee(db, identifier)
        # Detach spouse (do NOT cascade-delete the other attendee).
        if a.spouse_id:
            spouse = db.get(Attendee, a.spouse_id)
            if spouse:
                spouse.spouse_id = None
            rels = db.execute(
                select(SpouseRelationship).where(
                    (SpouseRelationship.attendee_one_id == a.id)
                    | (SpouseRelationship.attendee_two_id == a.id)
                )
            ).scalars().all()
            for r in rels:
                db.delete(r)
        # Remove invitations sent by this attendee (pending ones are revoked
        # first for the audit trail; all are then deleted with the record).
        sent_invites = db.execute(
            select(SpouseInvitation).where(SpouseInvitation.inviter_id == a.id)
        ).scalars().all()
        for inv in sent_invites:
            if inv.status == "pending":
                inv.status = "revoked"
            db.delete(inv)
        # Invitations accepted BY this attendee: clear the reference.
        accepted_invites = db.execute(
            select(SpouseInvitation).where(SpouseInvitation.accepted_by == a.id)
        ).scalars().all()
        for inv in accepted_invites:
            inv.accepted_by = None
        _audit(db, "registration.deleted", a.registration_id, organizer.email)
        db.delete(a)
    return DeleteResponse(ok=True)


@router.get("/stats", response_model=StatsResponse)
def stats(db: DBDep, organizer: StaffOnly):
    total = db.execute(select(func.count()).select_from(Attendee)).scalar() or 0

    def count_where(cond) -> int:
        return db.execute(select(func.count()).select_from(Attendee).where(cond)).scalar() or 0

    checked_in = count_where(Attendee.status == "checked_in")
    cancelled = count_where(Attendee.status == "cancelled")
    male = count_where(Attendee.gender == "male")
    female = count_where(Attendee.gender == "female")
    single = count_where(Attendee.marital_status == "single")
    married = count_where(Attendee.marital_status == "married")
    linked_pairs = db.execute(
        select(func.count()).select_from(SpouseRelationship)
    ).scalar() or 0
    pending_invites = db.execute(
        select(func.count()).select_from(SpouseInvitation).where(SpouseInvitation.status == "pending")
    ).scalar() or 0

    now = datetime.now(timezone.utc).date()
    day_rows = db.execute(
        select(
            func.date(Attendee.created_at),
            func.count(),
        )
        .where(Attendee.created_at >= now - timedelta(days=13))
        .group_by(func.date(Attendee.created_at))
    ).all()
    day_map = {str(d): c for d, c in day_rows}
    by_day = [
        {
            "date": (now - timedelta(days=i)).isoformat(),
            "label": (now - timedelta(days=i)).strftime("%-d %b"),
            "count": day_map.get((now - timedelta(days=i)).isoformat(), 0),
        }
        for i in range(13, -1, -1)
    ]

    occ_rows = db.execute(
        select(Attendee.occupation, func.count())
        .where(Attendee.occupation.isnot(None))
        .group_by(Attendee.occupation)
        .order_by(func.count().desc())
        .limit(12)
    ).all()
    by_occupation = [{"label": o or "Unknown", "count": c} for o, c in occ_rows]

    return StatsResponse(
        total=total, checked_in=checked_in, cancelled=cancelled,
        male=male, female=female, single=single, married=married,
        linked_pairs=linked_pairs, pending_invites=pending_invites,
        by_day=by_day, by_occupation=by_occupation,
    )


@router.get("/spouse-invitations", response_model=list[AdminInviteItem])
def list_invites(db: DBDep, organizer: StaffOnly):
    invs = db.execute(
        select(SpouseInvitation).order_by(SpouseInvitation.created_at.desc())
    ).scalars().all()
    # Raw tokens are not stored; the admin list shows a masked reference.
    items = []
    for inv in invs:
        invitation_service._mark_expired_if_needed(inv)
        db.flush()
        items.append(
            AdminInviteItem(
                token=f"INV…{inv.token_hash[:8]}",
                status=inv.status,
                expires_at=inv.expires_at,
                created_at=inv.created_at,
                inviter=inv.inviter.full_name,
                inviter_registration_id=inv.inviter.registration_id,
                accepted_by=inv.accepted_by_attendee.full_name if inv.accepted_by_attendee else None,
                invite_url=f"(token held by inviter)",
            )
        )
    return items


@router.get("/audit-log", response_model=list[AuditItem])
def audit_log(db: DBDep, organizer: StaffOnly):
    rows = db.execute(
        select(AuditLog).order_by(AuditLog.at.desc()).limit(200)
    ).scalars().all()
    return [AuditItem(at=r.at, action=r.action, target=r.target, by=r.by) for r in rows]


@router.post("/qr/verify", response_model=QRVerifyResponse)
def verify_qr(payload: QRVerifyRequest, db: DBDep, organizer: StaffOnly):
    """Protected check-in verification: scan payload -> attendee summary."""
    parts = payload.qr_payload.strip().split("|")
    if len(parts) != 2 or parts[0] != "SMS26":
        return QRVerifyResponse(valid=False, message="Unrecognised QR code.")
    attendee = registration_service.find_by_registration_id(db, parts[1])
    if not attendee:
        return QRVerifyResponse(valid=False, message="QR code is not valid.")
    return QRVerifyResponse(
        valid=True,
        registration_id=attendee.registration_id,
        full_name=attendee.full_name,
        status=attendee.status,
        message="Valid attendee QR code.",
    )
