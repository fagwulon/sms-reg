"""Add raw token column to spouse_invitations.

Revision ID: 0003_add_invite_token
Revises: 0002_fix_schema
Create Date: 2026-11-09

Stores the raw invitation token alongside the SHA-256 hash so that
invite URLs can be reconstructed when the attendee views their
registration (instead of relying on sessionStorage).
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0003_add_invite_token"
down_revision: Union[str, None] = "0002_fix_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add token column (raw token, same length as hash)
    try:
        op.add_column(
            "spouse_invitations",
            sa.Column("token", sa.String(64), nullable=True),
        )
    except Exception:
        pass

    # Populate token from existing rows: since we can't reverse the hash,
    # existing rows will have NULL token. New invitations will have the token.
    # For existing pending invitations, the frontend already has the token
    # from the creation response, so this is acceptable.

    # Make token NOT NULL after adding (new rows will always have it)
    # But keep nullable for backward compatibility with existing data
    try:
        op.create_unique_constraint("uq_spouse_invitations_token", "spouse_invitations", ["token"])
    except Exception:
        pass

    try:
        op.create_index("ix_spouse_invitations_token", "spouse_invitations", ["token"])
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_index("ix_spouse_invitations_token", "spouse_invitations")
    except Exception:
        pass
    try:
        op.drop_constraint("uq_spouse_invitations_token", "spouse_invitations", type_="unique")
    except Exception:
        pass
    try:
        op.drop_column("spouse_invitations", "token")
    except Exception:
        pass
