"""Create or update an organizer account.

Usage:
    python scripts/create_organizer.py --email admin@smssummit.org \
        --password 'Summit2026!' --name 'Precious A.' --role admin
"""

from __future__ import annotations

import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select

from app.core.security import hash_password
from app.db.base import SessionLocal
from app.models import Organizer


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--email", required=True)
    p.add_argument("--password", required=True)
    p.add_argument("--name", required=True)
    p.add_argument("--role", default="organizer", choices=["admin", "organizer"])
    args = p.parse_args()

    with SessionLocal() as db:
        org = db.execute(
            select(Organizer).where(Organizer.email == args.email.strip().lower())
        ).scalar_one_or_none()
        if org:
            org.password_hash = hash_password(args.password)
            org.full_name = args.name
            org.role = args.role
            org.is_active = True
            print(f"Updated organizer {org.email} (role={org.role})")
        else:
            org = Organizer(
                full_name=args.name,
                email=args.email.strip().lower(),
                password_hash=hash_password(args.password),
                role=args.role,
                is_active=True,
            )
            db.add(org)
            print(f"Created organizer {org.email} (role={org.role})")
        db.commit()


if __name__ == "__main__":
    main()
