import hashlib
import json
import os
import re
import secrets
import time
from datetime import date, datetime
from pathlib import Path
from typing import Literal
from zoneinfo import ZoneInfo

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import delete, insert, select, update
from sqlalchemy.exc import OperationalError

from .db import appointments, barbers, database_path, items, make_engine, services, sessions, users

ZONE = ZoneInfo("America/Sao_Paulo")
SLOTS = [f"{9 + i // 2:02}:{'30' if i % 2 else '00'}" for i in range(18)]
COOKIE = "vertice-session"
PASSWORDS = PasswordHasher()
DUMMY_HASH = PASSWORDS.hash(secrets.token_urlsafe(32))
Status = Literal["confirmado", "em atendimento", "concluído", "cancelado"]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class BookingInput(Input):
    services: list[str] = Field(min_length=1, max_length=4)
    barber: str = Field(min_length=1, max_length=80)
    date: date
    time: str = Field(pattern=r"^\d{2}:\d{2}$")
    name: str = Field(min_length=3, max_length=200)
    phone: str = Field(max_length=30)
    note: str = Field(default="", max_length=500)

    @field_validator("name")
    @classmethod
    def valid_name(cls, value):
        value = value.strip()
        if len(value) < 3:
            raise ValueError("Informe seu nome completo.")
        return value

    @field_validator("phone")
    @classmethod
    def valid_phone(cls, value):
        value = re.sub(r"[^0-9]", "", value)
        if not re.fullmatch(r"[0-9]{10,11}", value):
            raise ValueError("Informe um telefone válido com DDD.")
        return value


class LoginInput(Input):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=1024)


class StatusInput(Input):
    status: Status


class ServiceOutput(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    priceCents: int
    duration: int


class BarberOutput(BaseModel):
    id: str
    name: str
    specialty: str
    rating: str


class CatalogOutput(BaseModel):
    services: list[ServiceOutput]
    barbers: list[BarberOutput]


class ItemOutput(BaseModel):
    id: str
    name: str
    priceCents: int
    duration: int


class AppointmentOutput(BookingInput):
    id: str
    status: Status
    totalCents: int
    duration: int
    items: list[ItemOutput]


class AvailabilityOutput(BaseModel):
    slots: list[str]


class UserOutput(BaseModel):
    username: str


class OkOutput(BaseModel):
    ok: bool


def now():
    return datetime.now(ZONE)


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def selected_services(connection, ids):
    if not ids or len(set(ids)) != len(ids) or ("combo" in ids and {"corte", "barba"}.intersection(ids)):
        raise HTTPException(422, "Seleção de serviços inválida.")
    rows = connection.execute(select(services).where(services.c.id.in_(ids))).mappings().all()
    if len(rows) != len(ids):
        raise HTTPException(422, "Serviço desconhecido.")
    return rows


def candidates(connection, barber):
    rows = connection.execute(select(barbers).order_by(barbers.c.position)).mappings().all()
    result = [b["id"] for b in rows if barber == "any" or b["id"] == barber]
    if not result:
        raise HTTPException(422, "Profissional desconhecido.")
    return result


def minute(value):
    return int(value[:2]) * 60 + int(value[3:])


def valid_time(day, slot, duration):
    current = now()
    return (slot in SLOTS and day.weekday() != 6 and day >= current.date()
            and minute(slot) + duration <= 19 * 60
            and (day > current.date() or minute(slot) > current.hour * 60 + current.minute))


def free(connection, day, slot, duration, barber_ids, exclude=None):
    query = select(appointments.c.barber).where(
        appointments.c.date == day.isoformat(), appointments.c.status != "cancelado",
        appointments.c.start_minute < minute(slot) + duration,
        appointments.c.start_minute + appointments.c.duration > minute(slot))
    if exclude:
        query = query.where(appointments.c.id != exclude)
    occupied = set(connection.execute(query).scalars())
    return [barber for barber in barber_ids if barber not in occupied]


def serialize(connection, row):
    parts = connection.execute(select(items).where(items.c.appointment_id == row["id"])).mappings().all()
    return {**{key: row[key] for key in ("id", "name", "phone", "note", "barber", "date", "time", "status", "duration")},
            "totalCents": row["total_cents"], "services": [p["service_id"] for p in parts],
            "items": [{"id": p["service_id"], "name": p["name"], "priceCents": p["price_cents"], "duration": p["duration"]} for p in parts]}


def create_app(path=None):
    app = FastAPI(title="Vértice Barbearia", version="1.0.0")
    app.state.engine = make_engine(path or database_path())
    origins = set(os.environ.get("BARBEARIA_ORIGINS", "http://127.0.0.1:3000,http://localhost:3000").split(","))

    @app.middleware("http")
    async def origin_check(request: Request, call_next):
        if request.method not in ("GET", "HEAD", "OPTIONS") and request.headers.get("origin") not in origins:
            return JSONResponse(status_code=403, content={"detail": "Origem não autorizada."})
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_error(_request, _error):
        return JSONResponse(status_code=422, content={"detail": "Confira os campos informados: nome, telefone, serviços, data e horário."})

    @app.exception_handler(OperationalError)
    async def database_error(_request, _error):
        return JSONResponse(status_code=503, content={"detail": "Banco indisponível. Tente novamente em instantes."})

    def connection():
        with app.state.engine.connect() as conn:
            yield conn

    def staff(request: Request):
        token = request.cookies.get(COOKIE, "")
        with app.state.engine.connect() as conn:
            user = conn.execute(select(sessions.c.username).where(
                sessions.c.token_hash == digest(token), sessions.c.expires_at > int(time.time()))).scalar_one_or_none()
        if not user:
            raise HTTPException(401, "Entre com sua conta da equipe.")
        return user

    @app.get("/")
    def root():
        return {"status": "ok", "message": "API da barbearia funcionando"}

    @app.get("/favicon.ico", include_in_schema=False)
    def favicon():
        return FileResponse(Path(__file__).resolve().parent / "static" / "favicon.ico", media_type="image/x-icon")

    @app.get("/api/health")
    def health(conn=Depends(connection)):
        conn.execute(select(services.c.id).limit(1))
        return {"status": "ok"}

    @app.get("/api/catalog", response_model=CatalogOutput)
    def catalog(conn=Depends(connection)):
        service_rows = conn.execute(select(services)).mappings().all()
        barber_rows = conn.execute(select(barbers).order_by(barbers.c.position)).mappings().all()
        return {"services": [{"id": s["id"], "name": s["name"], "description": s["description"],
                "icon": s["icon"], "priceCents": s["price_cents"], "duration": s["duration"]} for s in service_rows],
                "barbers": [{key: b[key] for key in ("id", "name", "specialty", "rating")} for b in barber_rows]}

    @app.get("/api/availability", response_model=AvailabilityOutput)
    def availability(date: date, barber: str, services: list[str] = Query(), conn=Depends(connection)):
        rows = selected_services(conn, services)
        ids = candidates(conn, barber)
        duration = sum(s["duration"] for s in rows)
        return {"slots": [s for s in SLOTS if valid_time(date, s, duration) and free(conn, date, s, duration, ids)]}

    @app.post("/api/appointments", status_code=201, response_model=AppointmentOutput)
    def create_booking(body: BookingInput, idempotency_key: str = Header(min_length=16, max_length=100)):
        request_hash = digest(json.dumps(body.model_dump(mode="json"), sort_keys=True))
        with app.state.engine.connect().execution_options(write_lock=True) as conn, conn.begin():
            existing = conn.execute(select(appointments).where(appointments.c.idempotency_key == idempotency_key)).mappings().first()
            if existing:
                if existing["request_hash"] != request_hash:
                    raise HTTPException(409, "Chave de confirmação já usada para outra reserva.")
                return serialize(conn, existing)
            rows = selected_services(conn, body.services)
            ids = candidates(conn, body.barber)
            duration = sum(s["duration"] for s in rows)
            if not valid_time(body.date, body.time, duration):
                raise HTTPException(422, "Data ou horário fora do expediente ou já encerrado.")
            available = free(conn, body.date, body.time, duration, ids)
            if not available:
                raise HTTPException(409, "Este horário não está mais disponível. Escolha outro.")
            code = "VT-" + secrets.token_hex(3).upper()
            while conn.execute(select(appointments.c.id).where(appointments.c.id == code)).first():
                code = "VT-" + secrets.token_hex(3).upper()
            data = {"id": code, "name": body.name, "phone": body.phone, "note": body.note,
                    "barber": available[0], "date": body.date.isoformat(), "time": body.time,
                    "start_minute": minute(body.time), "duration": duration,
                    "total_cents": sum(s["price_cents"] for s in rows), "status": "confirmado",
                    "idempotency_key": idempotency_key, "request_hash": request_hash}
            conn.execute(insert(appointments).values(**data))
            conn.execute(insert(items), [{"appointment_id": code, "service_id": s["id"],
                "name": s["name"], "price_cents": s["price_cents"], "duration": s["duration"]} for s in rows])
            return serialize(conn, data)

    @app.get("/api/appointments", dependencies=[Depends(staff)], response_model=list[AppointmentOutput])
    def agenda(start: date, end: date, barber: str | None = None, conn=Depends(connection)):
        if end < start or (end - start).days > 31:
            raise HTTPException(422, "Consulte um período de até 31 dias.")
        query = select(appointments).where(appointments.c.date >= start.isoformat(), appointments.c.date <= end.isoformat())
        if barber:
            candidates(conn, barber)
            query = query.where(appointments.c.barber == barber)
        return [serialize(conn, row) for row in conn.execute(query.order_by(appointments.c.date, appointments.c.time)).mappings()]

    @app.patch("/api/appointments/{code}/status", dependencies=[Depends(staff)], response_model=AppointmentOutput)
    def change_status(code: str, body: StatusInput):
        with app.state.engine.connect().execution_options(write_lock=True) as conn, conn.begin():
            row = conn.execute(select(appointments).where(appointments.c.id == code)).mappings().first()
            if not row:
                raise HTTPException(404, "Reserva não encontrada.")
            if row["status"] == "cancelado" and body.status != "cancelado":
                if not free(conn, date.fromisoformat(row["date"]), row["time"], row["duration"], [row["barber"]], code):
                    raise HTTPException(409, "Outra reserva ocupa este horário. Não foi possível reativar.")
            conn.execute(update(appointments).where(appointments.c.id == code).values(status=body.status))
            return serialize(conn, {**row, "status": body.status})

    @app.post("/api/auth/login", response_model=UserOutput)
    def login(body: LoginInput, response: Response):
        with app.state.engine.connect() as conn:
            password_hash = conn.execute(select(users.c.password_hash).where(users.c.username == body.username)).scalar_one_or_none()
        try:
            PASSWORDS.verify(password_hash or DUMMY_HASH, body.password)
        except VerificationError:
            raise HTTPException(401, "Usuário ou senha incorretos.") from None
        if not password_hash:
            raise HTTPException(401, "Usuário ou senha incorretos.")
        token = secrets.token_urlsafe(32)
        with app.state.engine.begin() as conn:
            conn.execute(delete(sessions).where(sessions.c.expires_at <= int(time.time())))
            conn.execute(insert(sessions).values(token_hash=digest(token), username=body.username, expires_at=int(time.time()) + 28800))
        response.set_cookie(COOKIE, token, max_age=28800, httponly=True, samesite="strict", path="/", secure=False)
        return {"username": body.username}

    @app.get("/api/auth/me", response_model=UserOutput)
    def me(user=Depends(staff)):
        return {"username": user}

    @app.post("/api/auth/logout", response_model=OkOutput)
    def logout(request: Request, response: Response):
        with app.state.engine.begin() as conn:
            conn.execute(delete(sessions).where(sessions.c.token_hash == digest(request.cookies.get(COOKIE, ""))))
        response.delete_cookie(COOKIE, path="/")
        return {"ok": True}

    return app


app = create_app()
