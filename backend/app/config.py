"""Validated application configuration sourced from process environment."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

from .db import database_path

DEFAULT_ORIGINS = frozenset({"http://127.0.0.1:3000", "http://localhost:3000"})


def _origins(value: str | None) -> frozenset[str]:
    if value is None:
        return DEFAULT_ORIGINS
    origins = frozenset(origin.strip().rstrip("/") for origin in value.split(",") if origin.strip())
    if not origins:
        raise ValueError("BARBEARIA_ORIGINS deve conter ao menos uma origem.")
    for origin in origins:
        parsed = urlsplit(origin)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.netloc
            or parsed.path
            or parsed.query
            or parsed.fragment
            or parsed.username
            or parsed.password
        ):
            raise ValueError(f"Origem inválida em BARBEARIA_ORIGINS: {origin!r}.")
    return origins


def _positive_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    try:
        value = default if raw is None else int(raw)
    except ValueError as error:
        raise ValueError(f"{name} deve ser um número inteiro.") from error
    if value <= 0:
        raise ValueError(f"{name} deve ser maior que zero.")
    return value


def _boolean(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    normalized = raw.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise ValueError(f"{name} deve usar true ou false.")


@dataclass(frozen=True, slots=True)
class Settings:
    database_path: Path
    allowed_origins: frozenset[str]
    session_ttl_seconds: int = 28_800
    cookie_secure: bool = False
    timezone: ZoneInfo = ZoneInfo("America/Sao_Paulo")
    cookie_name: str = "vertice-session"

    @classmethod
    def from_env(cls, *, path: str | Path | None = None) -> Settings:
        resolved_path = Path(path).expanduser().resolve() if path is not None else database_path()
        return cls(
            database_path=resolved_path,
            allowed_origins=_origins(os.environ.get("BARBEARIA_ORIGINS")),
            session_ttl_seconds=_positive_int("BARBEARIA_SESSION_TTL_SECONDS", 28_800),
            cookie_secure=_boolean("BARBEARIA_COOKIE_SECURE", False),
        )
