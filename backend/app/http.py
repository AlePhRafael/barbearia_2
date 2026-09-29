"""HTTP middleware and exception handlers."""

from __future__ import annotations

import json
import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError, SQLAlchemyError

from .errors import BookingError

LOGGER = logging.getLogger("barbearia.api")

FIELD_MESSAGES = {
    "name": "Informe um nome entre 3 e 200 caracteres.",
    "phone": "Informe um telefone com DDD, 10 ou 11 dígitos e até 30 caracteres.",
    "note": "A observação deve ter até 500 caracteres.",
    "services": "Confira os serviços selecionados.",
    "barber": "Confira o profissional selecionado.",
    "date": "Informe uma data válida.",
    "time": "Informe um horário válido.",
}


def install_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def validation_error(_request: Request, error: RequestValidationError) -> JSONResponse:
        fields = {
            str(item["loc"][1]): FIELD_MESSAGES[str(item["loc"][1])]
            for item in error.errors()
            if len(item["loc"]) > 1
            and item["loc"][0] == "body"
            and str(item["loc"][1]) in FIELD_MESSAGES
        }
        return JSONResponse(
            status_code=422,
            content={
                "detail": "Confira os campos informados.",
                "code": "validation_error",
                "fields": fields,
            },
        )

    @app.exception_handler(BookingError)
    async def booking_error(_request: Request, error: BookingError) -> JSONResponse:
        return JSONResponse(
            status_code=error.status_code,
            content={
                "detail": error.detail,
                "code": error.code,
                "fields": error.fields,
            },
        )

    @app.exception_handler(OperationalError)
    async def database_error(request: Request, error: OperationalError) -> JSONResponse:
        LOGGER.exception(
            json.dumps(
                {
                    "event": "database_unavailable",
                    "request_id": getattr(request.state, "request_id", None),
                    "error_type": type(error).__name__,
                }
            )
        )
        return JSONResponse(
            status_code=503,
            content={"detail": "Banco indisponível. Tente novamente em instantes."},
        )

    @app.exception_handler(SQLAlchemyError)
    async def unexpected_database_error(request: Request, error: SQLAlchemyError) -> JSONResponse:
        LOGGER.exception(
            json.dumps(
                {
                    "event": "database_error",
                    "request_id": getattr(request.state, "request_id", None),
                    "error_type": type(error).__name__,
                }
            )
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "Não foi possível concluir a operação no banco."},
        )


def install_http_middleware(app: FastAPI) -> None:
    @app.middleware("http")
    async def request_policy(request: Request, call_next):  # type: ignore[no-untyped-def]
        started = time.perf_counter()
        request_id = uuid.uuid4().hex
        request.state.request_id = request_id
        settings = request.app.state.settings

        if (
            request.method not in {"GET", "HEAD", "OPTIONS"}
            and request.headers.get("origin") not in settings.allowed_origins
        ):
            response = JSONResponse(status_code=403, content={"detail": "Origem não autorizada."})
        else:
            response = await call_next(request)

        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Request-ID"] = request_id
        LOGGER.info(
            json.dumps(
                {
                    "event": "request_completed",
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                },
                ensure_ascii=False,
            )
        )
        return response
