"""Staff authentication endpoints."""

from fastapi import APIRouter, HTTPException, Request, Response

from ..dependencies import StaffUser
from ..schemas import LoginInput, OkOutput, UserOutput
from ..services import authenticate, create_session, revoke_session

router = APIRouter(prefix="/api/auth")


@router.post("/login", response_model=UserOutput)
def login(request: Request, body: LoginInput, response: Response) -> dict[str, str]:
    engine = request.app.state.engine
    settings = request.app.state.settings
    if not authenticate(engine, body.username, body.password):
        raise HTTPException(401, "Usuário ou senha incorretos.")
    timestamp = int(request.app.state.clock().timestamp())
    token = create_session(engine, body.username, timestamp, settings.session_ttl_seconds)
    response.set_cookie(
        settings.cookie_name,
        token,
        max_age=settings.session_ttl_seconds,
        httponly=True,
        samesite="strict",
        path="/",
        secure=settings.cookie_secure,
    )
    return {"username": body.username}


@router.get("/me", response_model=UserOutput)
def me(user: StaffUser) -> dict[str, str]:
    return {"username": user}


@router.post("/logout", response_model=OkOutput)
def logout(request: Request, response: Response) -> dict[str, bool]:
    settings = request.app.state.settings
    revoke_session(
        request.app.state.engine,
        request.cookies.get(settings.cookie_name, ""),
    )
    response.delete_cookie(
        settings.cookie_name,
        path="/",
        secure=settings.cookie_secure,
        samesite="strict",
    )
    return {"ok": True}
