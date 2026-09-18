from alembic import context
from app.db import database_path, make_engine, metadata

engine = make_engine(database_path())
with engine.connect() as connection:
    context.configure(connection=connection, target_metadata=metadata, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()
engine.dispose()
