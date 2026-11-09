"""Simple in-memory per-client rate limiter for sensitive public endpoints.

Token-bucket style: each client (IP) gets RATE_LIMIT_PER_MINUTE requests per
60s sliding window. Suitable for a single-process deployment; for multi-process
deployments swap this for a Redis-backed limiter.

Old entries are periodically pruned to prevent unbounded memory growth.
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

# Periodic cleanup: remove empty windows older than 2 minutes to prevent
# unbounded memory growth as new client IPs are seen.
_CLEANUP_INTERVAL = 120  # seconds
_last_cleanup: float = 0


def _cleanup_empty_windows(now: float) -> None:
    """Remove window entries that are empty or whose last request is stale."""
    to_remove = [
        key for key, dq in _windows.items()
        if not dq or (now - dq[-1]) > _CLEANUP_INTERVAL
    ]
    for key in to_remove:
        del _windows[key]


def rate_limit(request: Request, key_prefix: str = "") -> None:
    limit = settings.RATE_LIMIT_PER_MINUTE
    if limit <= 0:
        return
    client = request.client.host if request.client else "unknown"
    key = f"{key_prefix}:{client}"
    now = time.monotonic()
    with _lock:
        # Periodically clean up stale entries to prevent memory leak.
        global _last_cleanup
        if now - _last_cleanup > _CLEANUP_INTERVAL:
            _cleanup_empty_windows(now)
            _last_cleanup = now

        dq = _windows[key]
        while dq and now - dq[0] > 60:
            dq.popleft()
        if len(dq) >= limit:
            raise ApiError(429, "rate_limited", "Too many attempts. Please wait a minute and try again.")
        dq.append(now)
