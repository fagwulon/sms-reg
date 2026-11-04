"""Shared error envelope.

Frontend contract (API-CONTRACT.md §1):

    {"detail": {"code": "...", "message": "...", "fields": {...} | null}}
"""

from __future__ import annotations

from typing import Any, Dict, Optional


class ApiError(Exception):
    def __init__(self, status_code: int, code: str, message: str,
                 fields: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.fields = fields


def error_body(code: str, message: str, fields: Optional[Dict[str, Any]] = None) -> dict:
    return {"detail": {"code": code, "message": message, "fields": fields}}
