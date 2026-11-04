"""Confirmed spouse relationship between two independent attendee records."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Uuid

from app.db.base import Base


class SpouseRelationship(Base):
    __tablename__ = "spouse_relationships"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    attendee_one_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("attendees.id", ondelete="CASCADE"), index=True
    )
    attendee_two_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("attendees.id", ondelete="CASCADE"), index=True
    )
    invitation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("spouse_invitations.id", ondelete="CASCADE"), unique=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        # A relationship always connects two different people.
        CheckConstraint(
            "attendee_one_id <> attendee_two_id", name="ck_relationship_not_self"
        ),
        # Each side of a pair appears at most once (one active spouse each).
        UniqueConstraint("attendee_one_id", name="uq_relationship_one"),
        UniqueConstraint("attendee_two_id", name="uq_relationship_two"),
    )
