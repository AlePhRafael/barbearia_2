"""Explicit SQLAlchemy Core queries used by the application services."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.engine import Connection, RowMapping

from .db import appointments, barbers, items, services
from .errors import BookingError


def selected_services(connection: Connection, ids: Sequence[str]) -> list[RowMapping]:
    if (
        not ids
        or len(set(ids)) != len(ids)
        or ("combo" in ids and {"corte", "barba"}.intersection(ids))
    ):
        raise BookingError(422, "Seleção de serviços inválida.", "invalid_services")
    rows = list(connection.execute(select(services).where(services.c.id.in_(ids))).mappings())
    if len(rows) != len(ids):
        raise BookingError(422, "Serviço desconhecido.", "invalid_services")
    return rows


def barber_candidates(connection: Connection, barber: str) -> list[str]:
    rows = connection.execute(select(barbers).order_by(barbers.c.position)).mappings()
    result = [row["id"] for row in rows if barber == "any" or row["id"] == barber]
    if not result:
        raise BookingError(422, "Profissional desconhecido.", "invalid_barber")
    return result


def available_barbers(
    connection: Connection,
    day: date,
    start: int,
    duration: int,
    barber_ids: Sequence[str],
    *,
    exclude: str | None = None,
) -> list[str]:
    query = select(appointments.c.barber).where(
        appointments.c.date == day.isoformat(),
        appointments.c.status != "cancelado",
        appointments.c.start_minute < start + duration,
        appointments.c.start_minute + appointments.c.duration > start,
    )
    if exclude:
        query = query.where(appointments.c.id != exclude)
    occupied = set(connection.execute(query).scalars())
    return [barber for barber in barber_ids if barber not in occupied]


def serialize_appointment(
    connection: Connection,
    row: Mapping[str, Any] | RowMapping,
    parts: Sequence[Mapping[str, Any] | RowMapping] | None = None,
) -> dict[str, Any]:
    if parts is None:
        parts = (
            connection.execute(select(items).where(items.c.appointment_id == row["id"]))
            .mappings()
            .all()
        )
    return {
        **{
            key: row[key]
            for key in (
                "id",
                "name",
                "phone",
                "note",
                "barber",
                "date",
                "time",
                "status",
                "duration",
            )
        },
        "totalCents": row["total_cents"],
        "services": [part["service_id"] for part in parts],
        "items": [
            {
                "id": part["service_id"],
                "name": part["name"],
                "priceCents": part["price_cents"],
                "duration": part["duration"],
            }
            for part in parts
        ],
    }
