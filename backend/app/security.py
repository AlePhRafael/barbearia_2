"""Password and session-token primitives."""

from __future__ import annotations

import hashlib
import secrets

from argon2 import PasswordHasher

PASSWORDS = PasswordHasher()
DUMMY_HASH = PASSWORDS.hash(secrets.token_urlsafe(32))


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()
