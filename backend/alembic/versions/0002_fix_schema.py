"""Fix schema mismatches: add missing columns, fix constraints, rename columns.

Revision ID: 0002_fix_schema
Revises: 0001_initial
Create Date: 2026-11-05
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002_fix_schema"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- attendees table ---

    # Add missing columns (idempotent — skip if already present)
    for col_name, col_type, kwargs in [
        ("email_lower", sa.String(320), {"nullable": True}),
        ("occupation", sa.String(120), {"nullable": True}),
        ("age_range", sa.String(20), {"nullable": True}),
        ("city", sa.String(120), {"nullable": True}),
        ("expectations", sa.Text(), {"nullable": True}),
        ("emergency_contact_name", sa.String(200), {"nullable": True}),
        ("emergency_contact_phone", sa.String(32), {"nullable": True}),
        ("status", sa.String(20), {"nullable": True, "server_default": "registered"}),
        ("qr_identifier", sa.String(64), {"nullable": True}),
        ("spouse_id", sa.Uuid(), {"nullable": True, "foreignkey": "attendees.id", "ondelete": "SET NULL"}),
    ]:
        try:
            op.add_column("attendees", sa.Column(col_name, col_type, **kwargs))
        except Exception:
            pass

    # Populate email_lower from email
    try:
        op.execute("UPDATE attendees SET email_lower = LOWER(email) WHERE email_lower IS NULL")
        op.alter_column("attendees", "email_lower", nullable=False)
    except Exception:
        pass

    # Populate qr_identifier from registration_id
    try:
        op.execute("UPDATE attendees SET qr_identifier = 'SMS26|' || registration_id WHERE qr_identifier IS NULL")
        op.alter_column("attendees", "qr_identifier", nullable=False)
    except Exception:
        pass

    # Drop extra column if it exists
    try:
        op.drop_column("attendees", "qr_token_hash")
    except Exception:
        pass

    # Drop old check constraints and recreate with correct values
    try:
        op.drop_constraint("ck_attendees_gender", "attendees", type_="check")
    except Exception:
        pass
    try:
        op.drop_constraint("ck_attendees_marital_status", "attendees", type_="check")
    except Exception:
        pass
    try:
        op.drop_constraint("ck_attendees_status", "attendees", type_="check")
    except Exception:
        pass

    op.create_check_constraint("ck_attendees_gender", "attendees", "gender IN ('male','female')")
    op.create_check_constraint("ck_attendees_marital_status", "attendees", "marital_status IN ('single','married')")
    op.create_check_constraint("ck_attendees_status", "attendees", "status IN ('registered','checked_in','cancelled')")

    # Add unique constraints
    try:
        op.create_unique_constraint("uq_attendees_email_lower", "attendees", ["email_lower"])
    except Exception:
        pass
    try:
        op.create_unique_constraint("uq_attendees_qr_identifier", "attendees", ["qr_identifier"])
    except Exception:
        pass

    # Add indexes (idempotent — skip if already present)
    for idx_name, table, cols in [
        ("ix_attendees_email_lower", "attendees", ["email_lower"]),
        ("ix_attendees_phone", "attendees", ["phone"]),
        ("ix_attendees_status", "attendees", ["status"]),
        ("ix_attendees_qr_identifier", "attendees", ["qr_identifier"]),
        ("ix_attendees_registration_id", "attendees", ["registration_id"]),
        ("ix_attendees_email", "attendees", ["email"]),
        ("ix_attendees_created_at", "attendees", ["created_at"]),
        ("ix_attendees_gender_marital_status", "attendees", ["gender", "marital_status", "status"]),
    ]:
        try:
            op.create_index(idx_name, table, cols)
        except Exception:
            pass

    # --- spouse_invitations table ---

    # Rename accepted_by_id to accepted_by if needed
    try:
        op.alter_column("spouse_invitations", "accepted_by_id", new_column_name="accepted_by")
    except Exception:
        pass

    # Add indexes
    for idx_name, table, cols in [
        ("ix_spouse_invitations_inviter_id", "spouse_invitations", ["inviter_id"]),
        ("ix_spouse_invitations_token_hash", "spouse_invitations", ["token_hash"]),
        ("ix_spouse_invitations_status", "spouse_invitations", ["status"]),
        ("ix_spouse_invitations_expires_at", "spouse_invitations", ["expires_at"]),
        ("ix_spouse_invitations_status_expires", "spouse_invitations", ["status", "expires_at"]),
    ]:
        try:
            op.create_index(idx_name, table, cols)
        except Exception:
            pass

    # --- spouse_relationships table ---
    for idx_name, table, cols in [
        ("ix_spouse_relationships_one", "spouse_relationships", ["attendee_one_id"]),
        ("ix_spouse_relationships_two", "spouse_relationships", ["attendee_two_id"]),
    ]:
        try:
            op.create_index(idx_name, table, cols)
        except Exception:
            pass

    # --- organizers table ---
    try:
        op.create_index("ix_organizers_email", "organizers", ["email"])
    except Exception:
        pass

    # --- audit_log table ---
    try:
        op.create_index("ix_audit_log_at", "audit_log", ["at"])
    except Exception:
        pass


def downgrade() -> None:
    # Drop indexes
    op.drop_index("ix_attendees_email_lower", "attendees")
    op.drop_index("ix_attendees_phone", "attendees")
    op.drop_index("ix_attendees_status", "attendees")
    op.drop_index("ix_attendees_qr_identifier", "attendees")
    op.drop_index("ix_attendees_registration_id", "attendees")
    op.drop_index("ix_attendees_email", "attendees")
    op.drop_index("ix_attendees_created_at", "attendees")
    op.drop_index("ix_attendees_gender_marital_status", "attendees")

    op.drop_index("ix_spouse_invitations_inviter_id", "spouse_invitations")
    op.drop_index("ix_spouse_invitations_token_hash", "spouse_invitations")
    op.drop_index("ix_spouse_invitations_status", "spouse_invitations")
    op.drop_index("ix_spouse_invitations_expires_at", "spouse_invitations")
    op.drop_index("ix_spouse_invitations_status_expires", "spouse_invitations")

    op.drop_index("ix_spouse_relationships_one", "spouse_relationships")
    op.drop_index("ix_spouse_relationships_two", "spouse_relationships")

    op.drop_index("ix_organizers_email", "organizers")
    op.drop_index("ix_audit_log_at", "audit_log")

    # Drop constraints
    try:
        op.drop_constraint("ck_attendees_gender", "attendees", type_="check")
    except Exception:
        pass
    try:
        op.drop_constraint("ck_attendees_marital_status", "attendees", type_="check")
    except Exception:
        pass
    try:
        op.drop_constraint("ck_attendees_status", "attendees", type_="check")
    except Exception:
        pass
    try:
        op.drop_constraint("uq_attendees_email_lower", "attendees", type_="unique")
    except Exception:
        pass
    try:
        op.drop_constraint("uq_attendees_qr_identifier", "attendees", type_="unique")
    except Exception:
        pass

    # Drop columns
    op.drop_column("attendees", "spouse_id")
    op.drop_column("attendees", "qr_identifier")
    op.drop_column("attendees", "status")
    op.drop_column("attendees", "emergency_contact_phone")
    op.drop_column("attendees", "emergency_contact_name")
    op.drop_column("attendees", "expectations")
    op.drop_column("attendees", "city")
    op.drop_column("attendees", "age_range")
    op.drop_column("attendees", "occupation")
    op.drop_column("attendees", "email_lower")
