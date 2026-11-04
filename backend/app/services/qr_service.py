"""QR code generation.

Each attendee gets an opaque, unique payload of the form `SMS26|<registration_id>`.
No personal data is encoded — the payload is verified server-side against the
database. An optional PNG rendering is provided for organisers/tickets.
"""

from __future__ import annotations

import io

from app.core.config import get_settings

settings = get_settings()


def qr_png_bytes(payload: str) -> bytes:
    """Render the QR payload to PNG bytes. Requires qrcode[pil]."""
    import qrcode  # imported lazily so the API runs without Pillow if needed

    img = qrcode.make(payload)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
