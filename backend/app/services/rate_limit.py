"""Simple in-memory per-client rate limiter for sensitive public endpoints.

Token-bucket style: each client (IP) gets RATE_LIMIT_PER_MINUTE requests per
60s sliding window. Suitable for a single-process deployment; for multi-process
deployments swap this for a Redis-backed limiter.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import Request

from app.core.config import get_settings
from app.schemas.common import ApiError

settings = get_settings()

_windows: dict[str, deque] = defaultdict(deque)
_lock = Lock()


def rate_limit(request: Request, key_prefix: str = "") -> None:
    limit = settings.RATE_LIMIT_PER_MINUTE
    if limit <= 0:
        return
    client = request.client.host if request.client else "unknown"
    key = f"{key_prefix}:{client}"
    now = time.monotonic()
    with _lock:
        dq = _windows[key]
        while dq and now - dq[0] > 60:
            dq.popleft()
        if len(dq) >= limit:
            raise ApiError(429, "rate_limited", "Too many attempts. Please wait a minute and try again.")
        dq.append(now)
