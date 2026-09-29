"""HTTP request and response contracts."""

from __future__ import annotations

import re
from datetime import date
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Status(StrEnum):
    CONFIRMED = "confirmado"
    IN_SERVICE = "em atendimento"
    COMPLETED = "concluído"
    CANCELLED = "cancelado"


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
    def valid_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 3:
            raise ValueError("Informe seu nome completo.")
        return value

    @field_validator("phone")
    @classmethod
    def valid_phone(cls, value: str) -> str:
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
