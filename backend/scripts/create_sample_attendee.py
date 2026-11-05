"""Create a sample attendee for testing.

Usage:
    python scripts/create_sample_attendee.py
"""

from __future__ import annotations

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.base import SessionLocal
from app.schemas.registration import RegistrationCreate
from app.services import invitation_service
from app.services.registration_service import create_attendee, find_by_email


def main() -> None:
    email = "john.doe@example.com"

    with SessionLocal() as db:
        # Skip if already registered
        existing = find_by_email(db, email)
        if existing:
            print(f"Attendee already exists: {existing.registration_id} ({existing.full_name})")
            return

        data = RegistrationCreate(
            full_name="John Doe",
            email=email,
            phone="+1234567890",
            gender="male",
            marital_status="married",
            occupation="Software Engineer",
            age_range="25-34",
            city="New York",
            expectations="Looking forward to networking and learning about the latest trends.",
            emergency_contact_name="Jane Doe",
            emergency_contact_phone="+0987654321",
            wants_spouse_invite=True,
        )

        attendee = create_attendee(db, data)
        print(f"Created attendee: {attendee.registration_id} ({attendee.full_name})")

        # Create spouse invitation
        inv, token = invitation_service.create_invitation(db, attendee.registration_id)
        invite_url = invitation_service.invite_url(token)
        print(f"Spouse invite token: {token}")
        print(f"Invite URL: {invite_url}")
        print(f"Expires: {inv.expires_at}")

        db.commit()


if __name__ == "__main__":
    main()
