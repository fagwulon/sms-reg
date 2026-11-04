"""FastAPI dependencies: DB session, current organizer, role checks."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.base import get_db
from app.models import Organizer
from app.schemas.common import ApiError

DBDep = Annotated[Session, Depends(get_db)]


def get_current_organizer(
    authorization: Annotated[str | None, Header()] = None,
    db: DBDep = None,
) -> Organizer:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise ApiError(401, "not_authenticated", "Please sign in.")
    token = authorization.split(" ", 1)[1].strip()
    payload = decode_access_token(token)
    if not payload or payload.get("type") != "access":
        raise ApiError(401, "not_authenticated", "Session expired. Please sign in again.")
    try:
        organizer_id = uuid.UUID(payload["sub"])
    except (ValueError, KeyError, TypeError):
        raise ApiError(401, "not_authenticated", "Invalid session token.")
    organizer = db.get(Organizer, organizer_id)
    if not organizer or not organizer.is_active:
        raise ApiError(401, "not_authenticated", "Account is not active.")
    return organizer


def require_role(*roles: str):
    def checker(
        organizer: Annotated[Organizer, Depends(get_current_organizer)],
    ) -> Organizer:
        if organizer.role not in roles:
            raise ApiError(403, "forbidden", "Your role is not allowed to perform this action.")
        return organizer
    return checker


CurrentOrganizer = Annotated[Organizer, Depends(get_current_organizer)]
AdminOnly = Annotated[Organizer, Depends(require_role("admin"))]
StaffOnly = Annotated[Organizer, Depends(require_role("admin", "organizer"))]
