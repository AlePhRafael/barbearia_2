"""Database schema and SQLite engine configuration."""

from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy import (
    URL,
    CheckConstraint,
    Column,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    event,
)
from sqlalchemy.engine import Engine
from sqlalchemy.pool import NullPool

metadata = MetaData()

services = Table(
    "services",
    metadata,
    Column("id", String, primary_key=True),
    Column("name", String, nullable=False),
    Column("description", Text, nullable=False),
    Column("icon", String, nullable=False),
    Column("price_cents", Integer, nullable=False),
    Column("duration", Integer, nullable=False),
    CheckConstraint("price_cents >= 0", name="ck_services_price_cents"),
    CheckConstraint("duration > 0", name="ck_services_duration"),
)

barbers = Table(
    "barbers",
    metadata,
    Column("id", String, primary_key=True),
    Column("name", String, nullable=False),
    Column("specialty", String, nullable=False),
    Column("rating", String, nullable=False),
    Column("position", Integer, nullable=False),
    CheckConstraint("position >= 0", name="ck_barbers_position"),
)

appointments = Table(
    "appointments",
    metadata,
    Column("id", String, primary_key=True),
    Column("name", String, nullable=False),
    Column("phone", String, nullable=False),
    Column("note", Text, nullable=False),
    Column("barber", ForeignKey("barbers.id"), nullable=False),
    Column("date", String, nullable=False),
    Column("time", String, nullable=False),
    Column("start_minute", Integer, nullable=False),
    Column("duration", Integer, nullable=False),
    Column("total_cents", Integer, nullable=False),
    Column("status", String, nullable=False),
    Column("idempotency_key", String, unique=True, nullable=False),
    Column("request_hash", String, nullable=False),
    Column("created_at", Integer, nullable=False, server_default="0"),
    Column("updated_at", Integer, nullable=False, server_default="0"),
    CheckConstraint(
        "start_minute >= 0 AND start_minute < 1440", name="ck_appointments_start_minute"
    ),
    CheckConstraint("duration > 0", name="ck_appointments_duration"),
    CheckConstraint("total_cents >= 0", name="ck_appointments_total_cents"),
    CheckConstraint(
        "status IN ('confirmado', 'em atendimento', 'concluído', 'cancelado')",
        name="ck_appointments_status",
    ),
)
Index("ix_appointments_date_barber", appointments.c.date, appointments.c.barber)

items = Table(
    "appointment_items",
    metadata,
    Column("appointment_id", ForeignKey("appointments.id"), primary_key=True),
    Column("service_id", ForeignKey("services.id"), primary_key=True),
    Column("name", String, nullable=False),
    Column("price_cents", Integer, nullable=False),
    Column("duration", Integer, nullable=False),
    CheckConstraint("price_cents >= 0", name="ck_appointment_items_price_cents"),
    CheckConstraint("duration > 0", name="ck_appointment_items_duration"),
)

users = Table(
    "users",
    metadata,
    Column("username", String, primary_key=True),
    Column("password_hash", String, nullable=False),
)

sessions = Table(
    "sessions",
    metadata,
    Column("token_hash", String, primary_key=True),
    Column("username", ForeignKey("users.username"), nullable=False),
    Column("expires_at", Integer, nullable=False),
)
Index("ix_sessions_expires_at", sessions.c.expires_at)


def database_path() -> Path:
    """Resolve the operational database path without creating it."""
    local_data = os.environ.get("LOCALAPPDATA")
    base = Path(local_data) if local_data else Path.home() / ".local" / "share"
    default = base / "VerticeBarbearia" / "data" / "barbearia.sqlite3"
    return Path(os.environ.get("BARBEARIA_DB_PATH", default)).expanduser().resolve()


def make_engine(path: str | Path) -> Engine:
    """Create an engine with the transaction semantics required by bookings."""
    engine = create_engine(
        URL.create("sqlite", database=str(path)),
        connect_args={"check_same_thread": False, "timeout": 5},
        hide_parameters=True,
        poolclass=NullPool,
    )

    @event.listens_for(engine, "connect")
    def configure(connection: object, _record: object) -> None:
        connection.isolation_level = None  # type: ignore[attr-defined]
        connection.execute("PRAGMA foreign_keys=ON")  # type: ignore[attr-defined]
        connection.execute("PRAGMA busy_timeout=5000")  # type: ignore[attr-defined]

    @event.listens_for(engine, "begin")
    def begin(connection: object) -> None:
        write_lock = connection.get_execution_options().get("write_lock")  # type: ignore[attr-defined]
        statement = "BEGIN IMMEDIATE" if write_lock else "BEGIN"
        connection.exec_driver_sql(statement)  # type: ignore[attr-defined]

    return engine
