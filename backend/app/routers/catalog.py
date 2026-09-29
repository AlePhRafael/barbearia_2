"""Public catalog endpoints."""

from typing import Any

from fastapi import APIRouter

from ..dependencies import DatabaseConnection
from ..schemas import CatalogOutput
from ..services import catalog

router = APIRouter(prefix="/api")


@router.get("/catalog", response_model=CatalogOutput)
def get_catalog(connection: DatabaseConnection) -> dict[str, Any]:
    return catalog(connection)
