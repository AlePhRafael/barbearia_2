"""Application rules for bookings, availability, agenda and authentication."""

from __future__ import annotations

import json
import secrets
from collections.abc import Callable
from datetime import date, datetime
from typing import Any

from argon2.exceptions import VerificationError
from fastapi import HTTPException
from sqlalchemy import delete, insert, select, update
from sqlalchemy.engine import Connection, Engine, RowMapping

from .db import appointments, barbers, items, services, sessions, users
from .errors import BookingError
from .repositories import (
    available_barbers,
    barber_candidates,
    selected_services,
    serialize_appointment,
)
from .schemas import BookingInput, Status
from .security import DUMMY_HASH, PASSWORDS, digest

Clock = Callable[[], datetime]
SLOTS = tuple(f"{9 + index // 2:02}:{'30' if index % 2 else '00'}" for index in range(18))


def minute(value: str) -> int:
    return int(value[:2]) * 60 + int(value[3:])


def valid_time(day: date, slot: str, duration: int, current: datetime) -> bool:
    return (
        slot in SLOTS
        and day.weekday() != 6
        and day >= current.date()
        and minute(slot) + duration <= 19 * 60
        and (day > current.date() or minute(slot) > current.hour * 60 + current.minute)
    )


def catalog(connection: Connection) -> dict[str, Any]:
    service_rows = connection.execute(select(services)).mappings().all()
    barber_rows = connection.execute(select(barbers).order_by(barbers.c.position)).mappings().all()
    return {
        "services": [
            {
                "id": row["id"],
                "name": row["name"],
                "description": row["description"],
                "icon": row["icon"],
                "priceCents": row["price_cents"],
                "duration": row["duration"],
            }
            for row in service_rows
        ],
        "barbers": [
            {key: row[key] for key in ("id", "name", "specialty", "rating")} for row in barber_rows
        ],
    }


def availability(
    connection: Connection,
    day: date,
    barber: str,
    service_ids: list[str],
    current: datetime,
) -> dict[str, list[str]]:
    selected = selected_services(connection, service_ids)
    barber_ids = barber_candidates(connection, barber)
    duration = sum(row["duration"] for row in selected)
    occupied = (
        connection.execute(
            select(
                appointments.c.barber,
                appointments.c.start_minute,
                appointments.c.duration,
            ).where(
                appointments.c.date == day.isoformat(),
                appointments.c.status != "cancelado",
                appointments.c.barber.in_(barber_ids),
            )
        )
        .mappings()
        .all()
    )

    def slot_is_available(slot: str) -> bool:
        start = minute(slot)
        busy = {
            row["barber"]
            for row in occupied
            if row["start_minute"] < start + duration
            and row["start_minute"] + row["duration"] > start
        }
        return any(barber_id not in busy for barber_id in barber_ids)

    return {
        "slots": [
            slot
            for slot in SLOTS
            if valid_time(day, slot, duration, current) and slot_is_available(slot)
        ]
    }


def create_booking(
    engine: Engine,
    body: BookingInput,
    idempotency_key: str,
    current: datetime,
) -> dict[str, Any]:
    request_hash = digest(json.dumps(body.model_dump(mode="json"), sort_keys=True))
    timestamp = int(current.timestamp())
    with engine.connect().execution_options(write_lock=True) as connection, connection.begin():
        existing = (
            connection.execute(
                select(appointments).where(appointments.c.idempotency_key == idempotency_key)
            )
            .mappings()
            .first()
        )
        if existing:
            if existing["request_hash"] != request_hash:
                raise BookingError(
                    409,
                    "Chave de confirmação já usada para outra reserva.",
                    "idempotency_conflict",
                )
            return serialize_appointment(connection, existing)

        selected = selected_services(connection, body.services)
        barber_ids = barber_candidates(connection, body.barber)
        duration = sum(row["duration"] for row in selected)
        if not valid_time(body.date, body.time, duration, current):
            raise BookingError(
                422,
                "Data ou horário fora do expediente ou já encerrado.",
                "invalid_schedule",
            )
        available = available_barbers(
            connection,
            body.date,
            minute(body.time),
            duration,
            barber_ids,
        )
        if not available:
            raise BookingError(
                409,
                "Este horário não está mais disponível. Escolha outro.",
                "slot_unavailable",
            )

        code = "VT-" + secrets.token_hex(3).upper()
        while connection.execute(
            select(appointments.c.id).where(appointments.c.id == code)
        ).first():
            code = "VT-" + secrets.token_hex(3).upper()
        data = {
            "id": code,
            "name": body.name,
            "phone": body.phone,
            "note": body.note,
            "barber": available[0],
            "date": body.date.isoformat(),
            "time": body.time,
            "start_minute": minute(body.time),
            "duration": duration,
            "total_cents": sum(row["price_cents"] for row in selected),
            "status": Status.CONFIRMED.value,
            "idempotency_key": idempotency_key,
            "request_hash": request_hash,
            "created_at": timestamp,
            "updated_at": timestamp,
        }
        connection.execute(insert(appointments).values(**data))
        connection.execute(
            insert(items),
            [
                {
                    "appointment_id": code,
                    "service_id": row["id"],
                    "name": row["name"],
                    "price_cents": row["price_cents"],
                    "duration": row["duration"],
                }
                for row in selected
            ],
        )
        return serialize_appointment(connection, data)


def agenda(
    connection: Connection,
    start: date,
    end: date,
    barber: str | None,
) -> list[dict[str, Any]]:
    if end < start or (end - start).days > 31:
        raise HTTPException(422, "Consulte um período de até 31 dias.")
    query = select(appointments).where(
        appointments.c.date >= start.isoformat(),
        appointments.c.date <= end.isoformat(),
    )
    if barber:
        barber_candidates(connection, barber)
        query = query.where(appointments.c.barber == barber)
    rows = (
        connection.execute(query.order_by(appointments.c.date, appointments.c.time))
        .mappings()
        .all()
    )
    if not rows:
        return []
    grouped: dict[str, list[RowMapping]] = {row["id"]: [] for row in rows}
    parts = connection.execute(select(items).where(items.c.appointment_id.in_(grouped))).mappings()
    for part in parts:
        grouped[part["appointment_id"]].append(part)
    return [serialize_appointment(connection, row, grouped[row["id"]]) for row in rows]


def change_status(
    engine: Engine,
    code: str,
    status: Status,
    current: datetime,
) -> dict[str, Any]:
    with engine.connect().execution_options(write_lock=True) as connection, connection.begin():
        row = (
            connection.execute(select(appointments).where(appointments.c.id == code))
            .mappings()
            .first()
        )
        if not row:
            raise HTTPException(404, "Reserva não encontrada.")
        if row["status"] == Status.CANCELLED.value and status != Status.CANCELLED:
            available = available_barbers(
                connection,
                date.fromisoformat(row["date"]),
                minute(row["time"]),
                row["duration"],
                [row["barber"]],
                exclude=code,
            )
            if not available:
                raise HTTPException(
                    409,
                    "Outra reserva ocupa este horário. Não foi possível reativar.",
                )
        connection.execute(
            update(appointments)
            .where(appointments.c.id == code)
            .values(status=status.value, updated_at=int(current.timestamp()))
        )
        return serialize_appointment(connection, {**row, "status": status.value})


def authenticate(engine: Engine, username: str, password: str) -> bool:
    with engine.connect() as connection:
        password_hash = connection.execute(
            select(users.c.password_hash).where(users.c.username == username)
        ).scalar_one_or_none()
    try:
        PASSWORDS.verify(password_hash or DUMMY_HASH, password)
    except VerificationError:
        return False
    return password_hash is not None


def create_session(
    engine: Engine,
    username: str,
    current_timestamp: int,
    ttl_seconds: int,
) -> str:
    token = secrets.token_urlsafe(32)
    with engine.begin() as connection:
        connection.execute(delete(sessions).where(sessions.c.expires_at <= current_timestamp))
        connection.execute(
            insert(sessions).values(
                token_hash=digest(token),
                username=username,
                expires_at=current_timestamp + ttl_seconds,
            )
        )
    return token


def revoke_session(engine: Engine, token: str) -> None:
    with engine.begin() as connection:
        connection.execute(delete(sessions).where(sessions.c.token_hash == digest(token)))
