"""Initial schema: attendees, spouse_invitations, spouse_relationships, organizers, audit_log.

Revision ID: 0001_initial
Revises:
Create Date: 2026-11-04
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "attendees",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("registration_id", sa.String(32), nullable=False),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("email_lower", sa.String(320), nullable=False),
        sa.Column("phone", sa.String(32), nullable=False),
        sa.Column("gender", sa.String(10), nullable=False),
        sa.Column("marital_status", sa.String(10), nullable=False),
        sa.Column("occupation", sa.String(120), nullable=True),
        sa.Column("age_range", sa.String(20), nullable=True),
        sa.Column("city", sa.String(120), nullable=True),
        sa.Column("expectations", sa.Text(), nullable=True),
        sa.Column("emergency_contact_name", sa.String(200), nullable=True),
        sa.Column("emergency_contact_phone", sa.String(32), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="registered"),
        sa.Column("qr_identifier", sa.String(64), nullable=False),
        sa.Column("spouse_id", sa.Uuid(), sa.ForeignKey("attendees.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("registration_id", name="uq_attendees_registration_id"),
        sa.UniqueConstraint("email", name="uq_attendees_email"),
        sa.UniqueConstraint("email_lower", name="uq_attendees_email_lower"),
        sa.UniqueConstraint("qr_identifier", name="uq_attendees_qr_identifier"),
        sa.CheckConstraint("gender IN ('male','female')", name="ck_attendees_gender"),
        sa.CheckConstraint("marital_status IN ('single','married')", name="ck_attendees_marital_status"),
        sa.CheckConstraint("status IN ('registered','checked_in','cancelled')", name="ck_attendees_status"),
    )
    op.create_index("ix_attendees_registration_id", "attendees", ["registration_id"])
    op.create_index("ix_attendees_email", "attendees", ["email"])
    op.create_index("ix_attendees_email_lower", "attendees", ["email_lower"])
    op.create_index("ix_attendees_phone", "attendees", ["phone"])
    op.create_index("ix_attendees_status", "attendees", ["status"])
    op.create_index("ix_attendees_qr_identifier", "attendees", ["qr_identifier"])
    op.create_index("ix_attendees_created_at", "attendees", ["created_at"])
    op.create_index("ix_attendees_gender_marital_status", "attendees", ["gender", "marital_status", "status"])

    op.create_table(
        "spouse_invitations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("inviter_id", sa.Uuid(), sa.ForeignKey("attendees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("status", sa.String(10), nullable=False, server_default="pending"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_by", sa.Uuid(), sa.ForeignKey("attendees.id", ondelete="SET NULL"), nullable=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("token_hash", name="uq_spouse_invitations_token_hash"),
        sa.CheckConstraint("status IN ('pending','accepted','expired','revoked')", name="ck_spouse_invitations_status"),
    )
    op.create_index("ix_spouse_invitations_inviter_id", "spouse_invitations", ["inviter_id"])
    op.create_index("ix_spouse_invitations_token_hash", "spouse_invitations", ["token_hash"])
    op.create_index("ix_spouse_invitations_status", "spouse_invitations", ["status"])
    op.create_index("ix_spouse_invitations_expires_at", "spouse_invitations", ["expires_at"])
    op.create_index("ix_spouse_invitations_status_expires", "spouse_invitations", ["status", "expires_at"])

    op.create_table(
        "spouse_relationships",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("attendee_one_id", sa.Uuid(), sa.ForeignKey("attendees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("attendee_two_id", sa.Uuid(), sa.ForeignKey("attendees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("invitation_id", sa.Uuid(), sa.ForeignKey("spouse_invitations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("attendee_one_id <> attendee_two_id", name="ck_relationship_not_self"),
        sa.UniqueConstraint("attendee_one_id", name="uq_relationship_one"),
        sa.UniqueConstraint("attendee_two_id", name="uq_relationship_two"),
        sa.UniqueConstraint("invitation_id", name="uq_relationship_invitation"),
    )
    op.create_index("ix_spouse_relationships_one", "spouse_relationships", ["attendee_one_id"])
    op.create_index("ix_spouse_relationships_two", "spouse_relationships", ["attendee_two_id"])

    op.create_table(
        "organizers",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="organizer"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("email", name="uq_organizers_email"),
    )
    op.create_index("ix_organizers_email", "organizers", ["email"])

    op.create_table(
        "audit_log",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("action", sa.String(80), nullable=False),
        sa.Column("target", sa.String(64), nullable=True),
        sa.Column("by", sa.String(320), nullable=True),
    )
    op.create_index("ix_audit_log_at", "audit_log", ["at"])


def downgrade() -> None:
    op.drop_table("audit_log")
    op.drop_table("organizers")
    op.drop_table("spouse_relationships")
    op.drop_table("spouse_invitations")
    op.drop_table("attendees")
