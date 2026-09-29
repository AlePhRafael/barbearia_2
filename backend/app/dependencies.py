"""FastAPI dependencies shared by routers."""

from __future__ import annotations

from collections.abc import Generator
from typing import Annotated, cast

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.engine import Connection

from .db import sessions
from .security import digest


def connection(request: Request) -> Generator[Connection, None, None]:
    with request.app.state.engine.connect() as database_connection:
        yield database_connection


def staff(request: Request) -> str:
    settings = request.app.state.settings
    token = request.cookies.get(settings.cookie_name, "")
    timestamp = int(request.app.state.clock().timestamp())
    with request.app.state.engine.connect() as database_connection:
        username = database_connection.execute(
            select(sessions.c.username).where(
                sessions.c.token_hash == digest(token),
                sessions.c.expires_at > timestamp,
            )
        ).scalar_one_or_none()
    if not username:
        raise HTTPException(401, "Entre com sua conta da equipe.")
    return cast(str, username)


DatabaseConnection = Annotated[Connection, Depends(connection)]
StaffUser = Annotated[str, Depends(staff)]
