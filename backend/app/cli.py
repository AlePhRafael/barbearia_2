"""Local maintenance: python -m app.cli --help (run from backend)."""

from __future__ import annotations

import argparse
import getpass
import os
import sqlite3
from collections.abc import Sequence
from contextlib import closing
from pathlib import Path

from alembic import command
from alembic.config import Config
from argon2 import PasswordHasher
from sqlalchemy import insert, select
from sqlalchemy.engine import Engine

from .db import barbers, database_path, make_engine, services, users


def migrate(path: Path) -> None:
    """Create the parent directory and upgrade one explicit database to head."""
    path = path.expanduser().resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    previous = os.environ.get("BARBEARIA_DB_PATH")
    os.environ["BARBEARIA_DB_PATH"] = str(path)
    try:
        config_path = Path(__file__).resolve().parents[1] / "alembic.ini"
        command.upgrade(Config(str(config_path)), "head")
    finally:
        if previous is None:
            os.environ.pop("BARBEARIA_DB_PATH", None)
        else:
            os.environ["BARBEARIA_DB_PATH"] = previous


def seed(engine: Engine) -> None:
    """Insert the canonical catalog without creating sample appointments."""
    service_rows = [
        (
            "corte",
            "Corte de cabelo",
            "Seu estilo, na medida certa. Do clássico ao contemporâneo.",
            40,
            6000,
            "scissors",
        ),
        (
            "barba",
            "Barba & toalha quente",
            "Ritual completo para uma barba alinhada e pele renovada.",
            30,
            4500,
            "razor",
        ),
        (
            "combo",
            "Corte + barba",
            "A experiência completa. Cabelo e barba em perfeita sintonia.",
            70,
            9500,
            "sparkles",
        ),
        (
            "sobrancelha",
            "Design de sobrancelha",
            "Os pequenos detalhes que fazem toda a diferença.",
            15,
            2000,
            "eye",
        ),
    ]
    barber_rows = [
        ("rafael", "Rafael Costa", "Clássicos & tesoura", "4,9", 0),
        ("lucas", "Lucas Santos", "Degradês & estilo urbano", "5,0", 1),
        ("andre", "André Oliveira", "Barbas & navalha", "4,9", 2),
    ]
    with engine.begin() as connection:
        for service_row in service_rows:
            if not connection.execute(
                select(services.c.id).where(services.c.id == service_row[0])
            ).first():
                connection.execute(
                    insert(services).values(
                        **dict(
                            zip(
                                (
                                    "id",
                                    "name",
                                    "description",
                                    "duration",
                                    "price_cents",
                                    "icon",
                                ),
                                service_row,
                                strict=True,
                            )
                        )
                    )
                )
        for barber_row in barber_rows:
            if not connection.execute(
                select(barbers.c.id).where(barbers.c.id == barber_row[0])
            ).first():
                connection.execute(
                    insert(barbers).values(
                        **dict(
                            zip(
                                ("id", "name", "specialty", "rating", "position"),
                                barber_row,
                                strict=True,
                            )
                        )
                    )
                )


def backup(source: Path, destination: Path) -> None:
    """Create a new verified SQLite backup without overwriting any file."""
    source = source.expanduser().resolve()
    destination = destination.expanduser().resolve()
    if source == destination or destination.exists():
        raise ValueError(
            "Escolha um arquivo novo, diferente do banco ativo. Na restauração, "
            "pare os servidores e arquive o banco antigo primeiro."
        )
    if not source.is_file():
        raise ValueError("O banco de origem não existe ou não é um arquivo.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    try:
        with (
            closing(sqlite3.connect(source.as_uri() + "?mode=ro", uri=True)) as src,
            closing(sqlite3.connect(destination)) as dest,
        ):
            src.backup(dest)
            if dest.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise ValueError("Falha na integridade do backup.")
    except Exception:
        destination.unlink(missing_ok=True)
        raise


def _create_user(engine: Engine, username: str, password: str) -> bool:
    with engine.begin() as connection:
        if connection.execute(select(users.c.username).where(users.c.username == username)).first():
            return False
        connection.execute(
            insert(users).values(
                username=username,
                password_hash=PasswordHasher().hash(password),
            )
        )
    return True


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["init", "user", "backup", "restore"])
    parser.add_argument("--username", default="equipe")
    parser.add_argument("--file", type=Path)
    args = parser.parse_args(argv)
    path = database_path()

    if args.action == "init":
        migrate(path)
        engine = make_engine(path)
        try:
            seed(engine)
        finally:
            engine.dispose()
        print(f"Banco inicializado: {path}. Nenhuma reserva fictícia foi criada.")
        return 0

    if args.action == "user":
        if not path.exists():
            parser.error("Execute init antes de cadastrar a equipe.")
        password = getpass.getpass("Senha da equipe (mínimo 12 caracteres): ")
        confirmation = getpass.getpass("Confirme a senha: ")
        if len(password) < 12 or len(password) > 1024 or password != confirmation:
            parser.error("Senhas diferentes ou tamanho inválido.")
        engine = make_engine(path)
        try:
            created = _create_user(engine, args.username, password)
        finally:
            engine.dispose()
        if not created:
            parser.error("Usuário já existe. Este comando não substitui credenciais existentes.")
        print("Usuário criado. A senha não foi gravada em texto puro.")
        return 0

    if not args.file:
        parser.error("Informe --file.")
    if args.action == "backup":
        backup(path, args.file)
    else:
        backup(args.file, path)
    print("Operação concluída e integridade verificada.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
