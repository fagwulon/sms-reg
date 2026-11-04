"""Spouse invitation model. Only the SHA-256 hash of the token is stored."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Uuid

from app.db.base import Base


class SpouseInvitation(Base):
    __tablename__ = "spouse_invitations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    inviter_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("attendees.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(10), default="pending", index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    accepted_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("attendees.id", ondelete="SET NULL"), nullable=True
    )
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    inviter: Mapped["Attendee"] = relationship(
        back_populates="invitations_sent", foreign_keys=[inviter_id]
    )
    accepted_by_attendee: Mapped["Attendee | None"] = relationship(
        foreign_keys=[accepted_by]
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','accepted','expired','revoked')",
            name="ck_spouse_invitations_status",
        ),
        Index("ix_spouse_invitations_status_expires", "status", "expires_at"),
    )
