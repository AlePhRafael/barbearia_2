import os
from pathlib import Path

from sqlalchemy import Column, ForeignKey, Index, Integer, MetaData, String, Table, Text, create_engine, event

metadata = MetaData()
services = Table("services", metadata,
    Column("id", String, primary_key=True), Column("name", String, nullable=False),
    Column("description", Text, nullable=False), Column("icon", String, nullable=False),
    Column("price_cents", Integer, nullable=False), Column("duration", Integer, nullable=False))
barbers = Table("barbers", metadata,
    Column("id", String, primary_key=True), Column("name", String, nullable=False),
    Column("specialty", String, nullable=False), Column("rating", String, nullable=False),
    Column("position", Integer, nullable=False))
appointments = Table("appointments", metadata,
    Column("id", String, primary_key=True), Column("name", String, nullable=False),
    Column("phone", String, nullable=False), Column("note", Text, nullable=False),
    Column("barber", ForeignKey("barbers.id"), nullable=False),
    Column("date", String, nullable=False), Column("time", String, nullable=False),
    Column("start_minute", Integer, nullable=False), Column("duration", Integer, nullable=False),
    Column("total_cents", Integer, nullable=False), Column("status", String, nullable=False),
    Column("idempotency_key", String, unique=True, nullable=False),
    Column("request_hash", String, nullable=False))
Index("ix_appointments_date_barber", appointments.c.date, appointments.c.barber)
items = Table("appointment_items", metadata,
    Column("appointment_id", ForeignKey("appointments.id"), primary_key=True),
    Column("service_id", ForeignKey("services.id"), primary_key=True),
    Column("name", String, nullable=False), Column("price_cents", Integer, nullable=False),
    Column("duration", Integer, nullable=False))
users = Table("users", metadata,
    Column("username", String, primary_key=True), Column("password_hash", String, nullable=False))
sessions = Table("sessions", metadata,
    Column("token_hash", String, primary_key=True),
    Column("username", ForeignKey("users.username"), nullable=False),
    Column("expires_at", Integer, nullable=False))


def database_path():
    default = Path(os.environ.get("LOCALAPPDATA", Path.home() / ".local/share")) / "VerticeBarbearia/data/barbearia.sqlite3"
    return Path(os.environ.get("BARBEARIA_DB_PATH", default)).expanduser().resolve()


def make_engine(path):
    from sqlalchemy import URL
    engine = create_engine(URL.create("sqlite", database=str(path)), connect_args={"check_same_thread": False, "timeout": 5})

    @event.listens_for(engine, "connect")
    def configure(connection, _):
        connection.isolation_level = None
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA busy_timeout=5000")

    @event.listens_for(engine, "begin")
    def begin(connection):
        connection.exec_driver_sql("BEGIN IMMEDIATE" if connection.get_execution_options().get("write_lock") else "BEGIN")

    return engine
