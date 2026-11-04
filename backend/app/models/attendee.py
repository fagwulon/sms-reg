"""Attendee (registration) model."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Uuid

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Attendee(Base):
    __tablename__ = "attendees"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    registration_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    email_lower: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    phone: Mapped[str] = mapped_column(String(32), index=True)
    gender: Mapped[str] = mapped_column(String(10))
    marital_status: Mapped[str] = mapped_column(String(10))
    occupation: Mapped[str | None] = mapped_column(String(120))
    age_range: Mapped[str | None] = mapped_column(String(20))
    city: Mapped[str | None] = mapped_column(String(120))
    expectations: Mapped[str | None] = mapped_column(Text)
    emergency_contact_name: Mapped[str | None] = mapped_column(String(200))
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(20), default="registered", index=True)
    qr_identifier: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    spouse_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("attendees.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    spouse: Mapped["Attendee | None"] = relationship(
        "Attendee", remote_side=[id], foreign_keys=[spouse_id]
    )
    invitations_sent: Mapped[list["SpouseInvitation"]] = relationship(
        back_populates="inviter", foreign_keys="SpouseInvitation.inviter_id"
    )

    __table_args__ = (
        CheckConstraint("gender IN ('male','female')", name="ck_attendees_gender"),
        CheckConstraint(
            "marital_status IN ('single','married')", name="ck_attendees_marital_status"
        ),
        CheckConstraint(
            "status IN ('registered','checked_in','cancelled')", name="ck_attendees_status"
        ),
        Index("ix_attendees_created_at", "created_at"),
        Index("ix_attendees_gender_marital_status", "gender", "marital_status", "status"),
    )
