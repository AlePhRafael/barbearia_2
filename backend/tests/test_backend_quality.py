from __future__ import annotations

import logging
import sqlite3
from contextlib import closing
from datetime import date, datetime

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import insert, update
from sqlalchemy.exc import IntegrityError, OperationalError

from app.cli import main, migrate, seed
from app.config import Settings
from app.db import make_engine, services, users
from app.main import PASSWORDS, ZONE, create_app
from app.services import valid_time

ORIGIN = {"Origin": "http://127.0.0.1:3000"}


def test_settings_normalize_and_validate_environment(tmp_path, monkeypatch):
    monkeypatch.setenv(
        "BARBEARIA_ORIGINS",
        " http://localhost:3000/, https://example.test ",
    )
    monkeypatch.setenv("BARBEARIA_SESSION_TTL_SECONDS", "60")
    monkeypatch.setenv("BARBEARIA_COOKIE_SECURE", "true")
    settings = Settings.from_env(path=tmp_path / "database.sqlite3")
    assert settings.allowed_origins == {
        "http://localhost:3000",
        "https://example.test",
    }
    assert settings.session_ttl_seconds == 60
    assert settings.cookie_secure is True

    monkeypatch.setenv("BARBEARIA_ORIGINS", "localhost:3000")
    with pytest.raises(ValueError, match="Origem inválida"):
        Settings.from_env(path=tmp_path / "database.sqlite3")


def test_domain_schedule_rules_are_independent_from_http():
    current = datetime(2030, 1, 7, 8, 0, tzinfo=ZONE)
    assert valid_time(date(2030, 1, 7), "09:00", 40, current)
    assert not valid_time(date(2030, 1, 6), "09:00", 40, current)  # Sunday
    assert not valid_time(date(2030, 1, 7), "18:30", 40, current)


def test_security_headers_request_id_and_sanitized_log(tmp_path, monkeypatch, caplog):
    path = tmp_path / "test.sqlite3"
    monkeypatch.setenv("BARBEARIA_DB_PATH", str(path))
    migrate(path)
    app = create_app(path, clock=lambda: datetime(2030, 1, 7, 8, 0, tzinfo=ZONE))
    seed(app.state.engine)
    caplog.set_level(logging.INFO, logger="barbearia.api")
    try:
        with TestClient(app, headers=ORIGIN) as client:
            response = client.post(
                "/api/appointments",
                headers={"Idempotency-Key": "quality-test-key-0001"},
                json={
                    "services": ["corte"],
                    "barber": "rafael",
                    "date": "2030-01-07",
                    "time": "09:00",
                    "name": "Nome Confidencial",
                    "phone": "11987654321",
                    "note": "Observação privada",
                },
            )
            assert response.status_code == 201
            assert response.headers["cache-control"] == "no-store"
            assert response.headers["x-content-type-options"] == "nosniff"
            assert response.headers["referrer-policy"] == "no-referrer"
            assert len(response.headers["x-request-id"]) == 32
        logs = caplog.text
        assert "Nome Confidencial" not in logs
        assert "11987654321" not in logs
        assert "Observação privada" not in logs
    finally:
        app.state.engine.dispose()


def test_database_constraints_and_timestamps(tmp_path, monkeypatch):
    path = tmp_path / "test.sqlite3"
    monkeypatch.setenv("BARBEARIA_DB_PATH", str(path))
    migrate(path)
    engine = make_engine(path)
    seed(engine)
    try:
        with pytest.raises(IntegrityError), engine.begin() as connection:
            connection.execute(
                update(services).where(services.c.id == "corte").values(price_cents=-1)
            )
    finally:
        engine.dispose()


def test_migration_002_preserves_existing_bookings(tmp_path, monkeypatch):
    path = tmp_path / "legacy.sqlite3"
    monkeypatch.setenv("BARBEARIA_DB_PATH", str(path))
    config = Config("alembic.ini")
    command.upgrade(config, "001")
    with closing(sqlite3.connect(path)) as connection:
        connection.execute(
            "INSERT INTO barbers VALUES (?, ?, ?, ?, ?)",
            ("rafael", "Rafael", "Tesoura", "5,0", 0),
        )
        connection.execute(
            "INSERT INTO appointments VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                "VT-ABC123",
                "Cliente",
                "11999999999",
                "",
                "rafael",
                "2030-01-07",
                "09:00",
                540,
                40,
                6000,
                "confirmado",
                "legacy-idempotency-key",
                "hash",
            ),
        )
        connection.commit()
    command.upgrade(config, "head")
    with closing(sqlite3.connect(path)) as connection:
        row = connection.execute("SELECT id, created_at, updated_at FROM appointments").fetchone()
        assert row is not None and row[0] == "VT-ABC123"
        assert row[1] > 0 and row[2] > 0
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                "UPDATE appointments SET status = 'desconhecido' WHERE id = 'VT-ABC123'"
            )


def test_secure_cookie_is_configurable(tmp_path, monkeypatch):
    path = tmp_path / "test.sqlite3"
    monkeypatch.setenv("BARBEARIA_DB_PATH", str(path))
    migrate(path)
    settings = Settings.from_env(path=path)
    settings = Settings(
        database_path=settings.database_path,
        allowed_origins=settings.allowed_origins,
        cookie_secure=True,
    )
    app = create_app(settings=settings, clock=lambda: datetime(2030, 1, 7, 8, 0, tzinfo=ZONE))
    seed(app.state.engine)
    with app.state.engine.begin() as connection:
        connection.execute(
            insert(users).values(username="equipe", password_hash=PASSWORDS.hash("senha-de-teste"))
        )
    try:
        with TestClient(app, headers=ORIGIN) as client:
            response = client.post(
                "/api/auth/login",
                json={"username": "equipe", "password": "senha-de-teste"},
            )
            assert response.status_code == 200
            assert "Secure" in response.headers["set-cookie"]
    finally:
        app.state.engine.dispose()


def test_database_errors_have_stable_public_responses(tmp_path, monkeypatch):
    unavailable = create_app(tmp_path / "uninitialized.sqlite3")
    with TestClient(unavailable) as client:
        response = client.get("/api/health")
        assert response.status_code == 503
        assert response.json() == {"detail": "Banco indisponível. Tente novamente em instantes."}

    database_error = create_app(tmp_path / "generic-error.sqlite3")

    def fail_catalog(_connection):
        raise IntegrityError("INSERT", {}, OperationalError("falha", {}, None))

    monkeypatch.setattr("app.routers.catalog.catalog", fail_catalog)
    with TestClient(database_error) as client:
        response = client.get("/api/catalog")
        assert response.status_code == 500
        assert response.json() == {"detail": "Não foi possível concluir a operação no banco."}


def test_cli_init_user_backup_and_restore(tmp_path, monkeypatch):
    path = tmp_path / "operational.sqlite3"
    backup_path = tmp_path / "backups" / "daily.sqlite3"
    monkeypatch.setenv("BARBEARIA_DB_PATH", str(path))
    assert main(["init"]) == 0

    answers = iter(["senha-profissional", "senha-profissional"])
    monkeypatch.setattr("app.cli.getpass.getpass", lambda _prompt: next(answers))
    assert main(["user", "--username", "equipe"]) == 0
    assert main(["backup", "--file", str(backup_path)]) == 0

    archived = tmp_path / "archived.sqlite3"
    path.rename(archived)
    assert main(["restore", "--file", str(backup_path)]) == 0
    with closing(sqlite3.connect(path)) as connection:
        assert connection.execute(
            "SELECT username FROM users WHERE username = 'equipe'"
        ).fetchone() == ("equipe",)
