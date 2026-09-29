from alembic import context

from app.db import database_path, make_engine, metadata

engine = make_engine(database_path())
with engine.connect() as connection:
    # SQLite cannot rebuild referenced tables while FK enforcement is active.
    # Batch migrations run with enforcement paused, then validate every relation
    # before restoring it on the same DB-API connection.
    raw_connection = connection.connection.driver_connection
    raw_connection.execute("PRAGMA foreign_keys=OFF")
    try:
        context.configure(connection=connection, target_metadata=metadata, render_as_batch=True)
        with context.begin_transaction():
            context.run_migrations()
            violations = raw_connection.execute("PRAGMA foreign_key_check").fetchall()
            if violations:
                raise RuntimeError(
                    f"Migração produziu violações de chave estrangeira: {violations!r}"
                )
    finally:
        raw_connection.execute("PRAGMA foreign_keys=ON")
engine.dispose()
