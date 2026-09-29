"""FastAPI application factory and composition root."""

from __future__ import annotations

from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi import FastAPI
from sqlalchemy.engine import Engine

from .config import Settings
from .db import make_engine
from .http import install_exception_handlers, install_http_middleware
from .routers import appointments, auth, catalog, system
from .security import PASSWORDS as PASSWORDS

ZONE = ZoneInfo("America/Sao_Paulo")


def now() -> datetime:
    return datetime.now(ZONE)


def create_app(
    path: str | Path | None = None,
    *,
    settings: Settings | None = None,
    engine: Engine | None = None,
    clock: Callable[[], datetime] | None = None,
) -> FastAPI:
    """Build an application with replaceable infrastructure for isolated tests."""
    if settings is not None and path is not None:
        raise ValueError("Informe path ou settings, não ambos.")
    resolved_settings = settings or Settings.from_env(path=path)
    owns_engine = engine is None
    resolved_engine = engine or make_engine(resolved_settings.database_path)
    # Keep the default indirect so existing runtime/tests may replace the clock safely.
    resolved_clock = clock or (lambda: now())

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        try:
            yield
        finally:
            if owns_engine:
                resolved_engine.dispose()

    application = FastAPI(
        title="Vértice Barbearia",
        version="1.0.0",
        lifespan=lifespan,
    )
    application.state.engine = resolved_engine
    application.state.settings = resolved_settings
    application.state.clock = resolved_clock

    install_http_middleware(application)
    install_exception_handlers(application)
    application.include_router(system.router)
    application.include_router(catalog.router)
    application.include_router(appointments.router)
    application.include_router(auth.router)
    return application


app = create_app()
