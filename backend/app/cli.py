"""Local maintenance: python -m app.cli --help (run from backend)."""
import argparse
import getpass
import os
import sqlite3
from pathlib import Path
from alembic import command
from alembic.config import Config
from argon2 import PasswordHasher
from sqlalchemy import insert, select
from .db import barbers, database_path, make_engine, services, users

def migrate(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    os.environ["BARBEARIA_DB_PATH"] = str(path)
    command.upgrade(Config(str(Path(__file__).resolve().parents[1] / "alembic.ini")), "head")

def seed(engine):
    service_rows = [
        ("corte", "Corte de cabelo", "Seu estilo, na medida certa. Do clássico ao contemporâneo.", 40, 6000, "scissors"),
        ("barba", "Barba & toalha quente", "Ritual completo para uma barba alinhada e pele renovada.", 30, 4500, "razor"),
        ("combo", "Corte + barba", "A experiência completa. Cabelo e barba em perfeita sintonia.", 70, 9500, "sparkles"),
        ("sobrancelha", "Design de sobrancelha", "Os pequenos detalhes que fazem toda a diferença.", 15, 2000, "eye")]
    barber_rows = [("rafael", "Rafael Costa", "Clássicos & tesoura", "4,9", 0),
                   ("lucas", "Lucas Santos", "Degradês & estilo urbano", "5,0", 1),
                   ("andre", "André Oliveira", "Barbas & navalha", "4,9", 2)]
    with engine.begin() as conn:
        for row in service_rows:
            if not conn.execute(select(services.c.id).where(services.c.id == row[0])).first():
                conn.execute(insert(services).values(**dict(zip(("id", "name", "description", "duration", "price_cents", "icon"), row))))
        for row in barber_rows:
            if not conn.execute(select(barbers.c.id).where(barbers.c.id == row[0])).first():
                conn.execute(insert(barbers).values(**dict(zip(("id", "name", "specialty", "rating", "position"), row))))

def backup(source, destination):
    if source.resolve() == destination.resolve() or destination.exists():
        raise ValueError("Escolha um arquivo novo, diferente do banco ativo. Na restauração, pare os servidores e arquive o banco antigo primeiro.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(source.as_uri() + "?mode=ro", uri=True) as src, sqlite3.connect(destination) as dest:
        src.backup(dest)
        if dest.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise ValueError("Falha na integridade do backup.")

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["init", "user", "backup", "restore"])
    parser.add_argument("--username", default="equipe")
    parser.add_argument("--file", type=Path)
    args = parser.parse_args()
    path = database_path()
    if args.action == "init":
        migrate(path)
        engine = make_engine(path)
        seed(engine)
        engine.dispose()
        print(f"Banco inicializado: {path}. Nenhuma reserva fictícia foi criada.")
    elif args.action == "user":
        if not path.exists():
            parser.error("Execute init antes de cadastrar a equipe.")
        password = getpass.getpass("Senha da equipe (mínimo 12 caracteres): ")
        if len(password) < 12 or len(password) > 1024 or password != getpass.getpass("Confirme a senha: "):
            parser.error("Senhas diferentes ou tamanho inválido.")
        engine = make_engine(path)
        with engine.begin() as conn:
            if conn.execute(select(users.c.username).where(users.c.username == args.username)).first():
                parser.error("Usuário já existe. Este comando não substitui credenciais existentes.")
            conn.execute(insert(users).values(username=args.username, password_hash=PasswordHasher().hash(password)))
        engine.dispose()
        print("Usuário criado. A senha não foi gravada em texto puro.")
    else:
        if not args.file:
            parser.error("Informe --file.")
        if args.action == "backup":
            backup(path, args.file.resolve())
        else:
            backup(args.file.resolve(), path)
        print("Operação concluída e integridade verificada.")

if __name__ == "__main__":
    main()
