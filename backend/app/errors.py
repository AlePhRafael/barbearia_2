"""Domain errors safe to expose through the API."""

from __future__ import annotations

from fastapi import HTTPException


class BookingError(HTTPException):
    def __init__(
        self,
        status: int,
        detail: str,
        code: str,
        fields: dict[str, str] | None = None,
    ) -> None:
        super().__init__(status, detail)
        self.code = code
        self.fields = fields or {}
