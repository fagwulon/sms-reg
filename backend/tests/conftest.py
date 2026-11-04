"""Test fixtures: isolated SQLite database + FastAPI TestClient.

Tests never touch a real Supabase database.
"""

from __future__ import annotations

import os
import uuid

# Configure the environment BEFORE importing any app modules.
os.environ.setdefault("RATE_LIMIT_PER_MINUTE", "100000")  # disable rate limiting in tests
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("DATABASE_URL", "sqlite://")  # unused; dependency override below

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import hash_password
from app.db.base import Base, get_db
from app.main import app
from app.models import Organizer

# --- isolated in-memory database ---
engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def clean_db():
    """Wipe all tables between tests."""
    with TestingSessionLocal() as db:
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(table.delete())
        db.commit()
    yield


@pytest.fixture
def db():
    with TestingSessionLocal() as session:
        yield session


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def organizer_credentials():
    return {"email": "admin@smssummit.org", "password": "Summit2026!"}


@pytest.fixture
def admin_token(client, organizer_credentials):
    with TestingSessionLocal() as db:
        db.add(
            Organizer(
                id=uuid.uuid4(),
                full_name="Precious A.",
                email=organizer_credentials["email"],
                password_hash=hash_password(organizer_credentials["password"]),
                role="admin",
                is_active=True,
            )
        )
        db.commit()
    res = client.post("/api/v1/auth/login", json=organizer_credentials)
    assert res.status_code == 200, res.text
    return res.json()["token"]


@pytest.fixture
def staff_token(client):
    creds = {"email": "desk@smssummit.org", "password": "Desk2026!"}
    with TestingSessionLocal() as db:
        db.add(
            Organizer(
                id=uuid.uuid4(),
                full_name="Desk Team",
                email=creds["email"],
                password_hash=hash_password(creds["password"]),
                role="organizer",
                is_active=True,
            )
        )
        db.commit()
    res = client.post("/api/v1/auth/login", json=creds)
    assert res.status_code == 200, res.text
    return res.json()["token"]


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def make_attendee_payload(**overrides) -> dict:
    payload = {
        "full_name": "Chinedu Okafor",
        "email": "chinedu@example.com",
        "phone": "+234 803 123 4567",
        "gender": "male",
        "marital_status": "married",
        "occupation": "Tech / Engineering",
        "age_range": "26-32",
        "city": "Port Harcourt",
        "expectations": "Clarity on courtship",
        "emergency_contact_name": "Ada Okafor",
        "emergency_contact_phone": "+234 803 000 0000",
        "wants_spouse_invite": False,
    }
    payload.update(overrides)
    return payload


def register_attendee(client, **overrides) -> dict:
    res = client.post("/api/v1/registrations", json=make_attendee_payload(**overrides))
    assert res.status_code == 201, res.text
    return res.json()
