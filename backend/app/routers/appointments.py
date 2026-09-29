"""Booking, availability and staff agenda endpoints."""

from datetime import date
from typing import Any

from fastapi import APIRouter, Header, Query, Request

from ..dependencies import DatabaseConnection, StaffUser
from ..schemas import AppointmentOutput, AvailabilityOutput, BookingInput, StatusInput
from ..services import agenda, availability, change_status, create_booking

router = APIRouter(prefix="/api")


@router.get("/availability", response_model=AvailabilityOutput)
def get_availability(
    request: Request,
    connection: DatabaseConnection,
    date: date,
    barber: str,
    services: list[str] = Query(),
) -> dict[str, list[str]]:
    return availability(connection, date, barber, services, request.app.state.clock())


@router.post("/appointments", status_code=201, response_model=AppointmentOutput)
def post_appointment(
    request: Request,
    body: BookingInput,
    idempotency_key: str = Header(min_length=16, max_length=100),
) -> dict[str, Any]:
    return create_booking(
        request.app.state.engine,
        body,
        idempotency_key,
        request.app.state.clock(),
    )


@router.get("/appointments", response_model=list[AppointmentOutput])
def get_agenda(
    connection: DatabaseConnection,
    _user: StaffUser,
    start: date,
    end: date,
    barber: str | None = None,
) -> list[dict[str, Any]]:
    return agenda(connection, start, end, barber)


@router.patch("/appointments/{code}/status", response_model=AppointmentOutput)
def patch_status(
    request: Request,
    code: str,
    body: StatusInput,
    _user: StaffUser,
) -> dict[str, Any]:
    return change_status(request.app.state.engine, code, body.status, request.app.state.clock())
