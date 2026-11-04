"""Security helpers: password hashing, JWT tokens, token generation.

Passwords are hashed with PBKDF2-HMAC-SHA256 (stdlib, no plaintext storage).
Invitation tokens are generated with `secrets` and only their SHA-256 hash
is persisted.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import get_settings

# ---------------------------------------------------------------------------
# Passwords
# ---------------------------------------------------------------------------

_PBKDF2_ITERATIONS = 260_000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(salt), _PBKDF2_ITERATIONS
    ).hex()
    return f"pbkdf2_sha256${_PBKDF2_ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        scheme, iterations, salt, digest = stored_hash.split("$")
        if scheme != "pbkdf2_sha256":
            return False
        candidate = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), bytes.fromhex(salt), int(iterations)
        ).hex()
        return hmac.compare_digest(candidate, digest)
    except (ValueError, AttributeError):
        return False


# ---------------------------------------------------------------------------
# JWT (organizer sessions)
# ---------------------------------------------------------------------------

def create_access_token(subject: str, role: str, name: str, email: str) -> tuple[str, datetime]:
    settings = get_settings()
    expires_at = datetime.now(timezone.utc) + timedelta(
        hours=settings.ACCESS_TOKEN_EXPIRE_HOURS
    )
    payload = {
        "sub": subject,
        "role": role,
        "name": name,
        "email": email,
        "exp": expires_at,
        "iat": datetime.now(timezone.utc),
        "type": "access",
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return token, expires_at


def decode_access_token(token: str) -> dict | None:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.PyJWTError:
        return None


# ---------------------------------------------------------------------------
# Invitation tokens & hashing
# ---------------------------------------------------------------------------

# Unambiguous alphabet (no I, O, 0, 1) for human-transcribable tokens.
_TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_invitation_token() -> str:
    """Cryptographically random, single-use invitation token (>= 20 chars)."""
    body = "".join(secrets.choice(_TOKEN_ALPHABET) for _ in range(21))
    return f"INV{body}"  # 24 chars total


def hash_token(token: str) -> str:
    """SHA-256 hex digest of a token — this is what gets stored in the DB."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_registration_code_part() -> str:
    """4 random chars from the unambiguous alphabet for SMS26-XXXX-NNNN."""
    return "".join(secrets.choice(_TOKEN_ALPHABET) for _ in range(4))
