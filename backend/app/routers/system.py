"""Service status endpoints."""

from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse
from sqlalchemy import select

from ..db import services
from ..dependencies import DatabaseConnection

router = APIRouter()


@router.get("/")
def root() -> dict[str, str]:
    return {"status": "ok", "message": "API da barbearia funcionando"}


@router.get("/favicon.ico", include_in_schema=False)
def favicon() -> FileResponse:
    path = Path(__file__).resolve().parents[1] / "static" / "favicon.ico"
    return FileResponse(path, media_type="image/x-icon")


@router.get("/api/health")
def health(connection: DatabaseConnection) -> dict[str, str]:
    connection.execute(select(services.c.id).limit(1))
    return {"status": "ok"}
