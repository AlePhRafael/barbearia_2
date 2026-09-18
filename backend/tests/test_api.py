from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from threading import Barrier
import sqlite3
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import insert, select, update

from app.cli import backup, migrate, seed
from app.db import appointments, services, sessions, users
from app.main import PASSWORDS, ZONE, create_app

ORIGIN = {"Origin": "http://127.0.0.1:3000"}


@pytest.fixture
def setup(tmp_path, monkeypatch):
    path = tmp_path / "test.sqlite3"
    monkeypatch.setenv("BARBEARIA_DB_PATH", str(path))
    monkeypatch.setattr("app.main.now", lambda: datetime(2030, 1, 7, 8, 0, tzinfo=ZONE))
    migrate(path)
    app = create_app(path)
    seed(app.state.engine)
    with app.state.engine.begin() as conn:
        conn.execute(insert(users).values(username="equipe", password_hash=PASSWORDS.hash("senha-de-teste")))
    with TestClient(app, headers=ORIGIN) as client:
        yield client, app, path
    app.state.engine.dispose()


def test_root_and_favicon_without_database(tmp_path, monkeypatch):
    favicon_path = Path(__file__).resolve().parents[1] / "app" / "static" / "favicon.ico"
    monkeypatch.chdir(tmp_path)
    path = tmp_path / "uninitialized.sqlite3"
    app = create_app(path)
    try:
        with TestClient(app) as client:
            response = client.get("/")
            assert response.status_code == 200
            assert response.json() == {"status": "ok", "message": "API da barbearia funcionando"}

            icon = client.get("/favicon.ico")
            assert icon.status_code == 200
            assert icon.headers["content-type"] == "image/x-icon"
            assert icon.content == favicon_path.read_bytes()
            assert icon.content.startswith(b"\x00\x00\x01\x00")
            assert icon.headers["Cache-Control"] == "no-store"
            assert not path.exists()
    finally:
        app.state.engine.dispose()


def payload(**changes):
    return {"services": ["corte"], "barber": "rafael", "date": "2030-01-07", "time": "09:00",
            "name": "Cliente Teste", "phone": "(11) 98765-4321", "note": "", **changes}


def book(client, body=None, key=None):
    return client.post("/api/appointments", json=body or payload(), headers={"Idempotency-Key": key or str(uuid.uuid4())})


def login(client):
    response = client.post("/api/auth/login", json={"username": "equipe", "password": "senha-de-teste"})
    assert response.status_code == 200
    return response


def test_persistence_history_and_backup(setup, tmp_path):
    client, app, path = setup
    response = book(client)
    assert response.status_code == 201
    saved = response.json()
    assert saved["phone"] == "11987654321"
    assert saved["totalCents"] == 6000 and saved["duration"] == 40
    with app.state.engine.begin() as conn:
        conn.execute(update(services).where(services.c.id == "corte").values(price_cents=9900, duration=90, name="Novo nome"))
    reopened = create_app(path)
    with TestClient(reopened, headers=ORIGIN) as second:
        login(second)
        result = second.get("/api/appointments?start=2030-01-07&end=2030-01-07").json()[0]
        assert result == saved
    reopened.state.engine.dispose()
    dest = tmp_path / "backup.sqlite3"
    backup(path, dest)
    restored = tmp_path / "restored.sqlite3"
    backup(dest, restored)
    with sqlite3.connect(restored) as conn:
        assert conn.execute("SELECT total_cents FROM appointments").fetchone() == (6000,)
    with pytest.raises(ValueError):
        backup(dest, path)


def test_overlap_adjacency_cancel_reactivate(setup):
    client, _, _ = setup
    first = book(client, payload(services=["barba"])).json()
    assert book(client, payload(time="09:30")).status_code == 201  # adjacent
    assert book(client).status_code == 409
    login(client)
    assert client.patch(f"/api/appointments/{first['id']}/status", json={"status": "cancelado"}).status_code == 200
    assert book(client, payload(services=["barba"])).status_code == 201
    assert client.patch(f"/api/appointments/{first['id']}/status", json={"status": "confirmado"}).status_code == 409


def test_concurrent_requests_one_winner(setup):
    _, app, _ = setup
    start = Barrier(2)
    def reserve(_):
        with TestClient(app, headers=ORIGIN) as client:
            start.wait(timeout=5)
            return book(client).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(reserve, range(2))) == [201, 409]
    with app.state.engine.connect() as conn:
        assert len(conn.execute(select(appointments)).all()) == 1


def test_idempotency_and_any(setup):
    client, _, _ = setup
    key = str(uuid.uuid4())
    first = book(client, payload(barber="any"), key)
    assert first.status_code == 201
    assert book(client, payload(barber="any"), key).json() == first.json()
    assert book(client, payload(barber="any", time="10:00"), key).status_code == 409
    assert book(client, payload(barber="any")).json()["barber"] == "lucas"
    assert book(client, payload(barber="any")).json()["barber"] == "andre"
    assert book(client, payload(barber="any")).status_code == 409


@pytest.mark.parametrize("changes", [
    {"name": "   "}, {"phone": "123"}, {"note": "x" * 501}, {"services": []},
    {"services": ["corte", "corte"]}, {"services": ["combo", "corte"]}, {"services": ["inexistente"]},
    {"barber": "inexistente"}, {"date": "2030-01-06"}, {"date": "2030-01-13"},
    {"date": "2030-02-30"}, {"time": "18:00"}, {"time": "09:15"}, {"time": "99:99"}, {"price": 1}])
def test_direct_api_validation(setup, changes):
    assert book(setup[0], payload(**changes)).status_code == 422


def test_past_and_closing(setup, monkeypatch):
    client, app, _ = setup
    monkeypatch.setattr("app.main.now", lambda: datetime(2030, 1, 7, 9, 0, tzinfo=ZONE))
    assert book(client).status_code == 422
    assert book(client, payload(services=["combo", "sobrancelha"], time="17:30")).status_code == 201
    with app.state.engine.begin() as conn:
        conn.execute(update(services).where(services.c.id == "combo").values(duration=100))
    assert book(client, payload(services=["combo"], barber="lucas", time="17:30")).status_code == 422


def test_auth_privacy_and_expiry(setup):
    client, app, _ = setup
    saved = book(client).json()
    assert client.get("/api/appointments?start=2030-01-07&end=2030-01-07").status_code == 401
    assert client.patch(f"/api/appointments/{saved['id']}/status", json={"status": "concluído"}).status_code == 401
    result = client.get("/api/availability?date=2030-01-07&barber=rafael&services=corte")
    assert set(result.json()) == {"slots"}
    assert "09:00" not in result.json()["slots"] and "09:30" not in result.json()["slots"]
    assert "Cliente" not in result.text
    assert client.post("/api/auth/login", json={"username": "equipe", "password": "errada"}).status_code == 401
    response = login(client)
    assert "HttpOnly" in response.headers["set-cookie"] and "SameSite=strict" in response.headers["set-cookie"]
    assert client.get("/api/auth/me").status_code == 200
    assert client.post("/api/auth/logout").status_code == 200
    assert client.get("/api/auth/me").status_code == 401
    login(client)
    with app.state.engine.begin() as conn:
        conn.execute(update(sessions).values(expires_at=0))
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/auth/logout", headers={"Origin": "https://outside.example"}).status_code == 403


def test_seed_is_repeatable_without_fake_bookings(setup):
    client, app, _ = setup
    seed(app.state.engine)
    assert len(client.get("/api/catalog").json()["services"]) == 4
    with app.state.engine.connect() as conn:
        assert not conn.execute(select(appointments)).all()
