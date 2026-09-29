"""Add integrity constraints, operational timestamps and session index."""

from __future__ import annotations

import time

import sqlalchemy as sa
from alembic import op

revision = "002"
down_revision = "001"


def _assert_valid_data() -> None:
    connection = op.get_bind()
    checks = {
        "services": "price_cents < 0 OR duration <= 0",
        "barbers": "position < 0",
        "appointments": (
            "start_minute < 0 OR start_minute >= 1440 OR duration <= 0 "
            "OR total_cents < 0 OR status NOT IN "
            "('confirmado', 'em atendimento', 'concluído', 'cancelado')"
        ),
        "appointment_items": "price_cents < 0 OR duration <= 0",
    }
    invalid = [
        table
        for table, condition in checks.items()
        if connection.execute(sa.text(f"SELECT 1 FROM {table} WHERE {condition} LIMIT 1")).first()
    ]
    if invalid:
        names = ", ".join(invalid)
        raise RuntimeError(
            f"A migração 002 encontrou dados inválidos em: {names}. "
            "Corrija-os em uma cópia do banco antes de continuar."
        )


def upgrade() -> None:
    _assert_valid_data()
    timestamp = int(time.time())
    op.add_column(
        "appointments",
        sa.Column("created_at", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "appointments",
        sa.Column("updated_at", sa.Integer(), nullable=False, server_default="0"),
    )
    op.execute(
        sa.text(
            "UPDATE appointments SET created_at = :timestamp, updated_at = :timestamp"
        ).bindparams(timestamp=timestamp)
    )

    with op.batch_alter_table("services") as batch:
        batch.create_check_constraint("ck_services_price_cents", "price_cents >= 0")
        batch.create_check_constraint("ck_services_duration", "duration > 0")
    with op.batch_alter_table("barbers") as batch:
        batch.create_check_constraint("ck_barbers_position", "position >= 0")
    with op.batch_alter_table("appointments") as batch:
        batch.create_check_constraint(
            "ck_appointments_start_minute",
            "start_minute >= 0 AND start_minute < 1440",
        )
        batch.create_check_constraint("ck_appointments_duration", "duration > 0")
        batch.create_check_constraint("ck_appointments_total_cents", "total_cents >= 0")
        batch.create_check_constraint(
            "ck_appointments_status",
            "status IN ('confirmado', 'em atendimento', 'concluído', 'cancelado')",
        )
    with op.batch_alter_table("appointment_items") as batch:
        batch.create_check_constraint("ck_appointment_items_price_cents", "price_cents >= 0")
        batch.create_check_constraint("ck_appointment_items_duration", "duration > 0")
    with op.batch_alter_table("sessions") as batch:
        batch.create_index("ix_sessions_expires_at", ["expires_at"])


def downgrade() -> None:
    with op.batch_alter_table("sessions") as batch:
        batch.drop_index("ix_sessions_expires_at")
    with op.batch_alter_table("appointment_items") as batch:
        batch.drop_constraint("ck_appointment_items_duration", type_="check")
        batch.drop_constraint("ck_appointment_items_price_cents", type_="check")
    with op.batch_alter_table("appointments") as batch:
        batch.drop_constraint("ck_appointments_status", type_="check")
        batch.drop_constraint("ck_appointments_total_cents", type_="check")
        batch.drop_constraint("ck_appointments_duration", type_="check")
        batch.drop_constraint("ck_appointments_start_minute", type_="check")
        batch.drop_column("updated_at")
        batch.drop_column("created_at")
    with op.batch_alter_table("barbers") as batch:
        batch.drop_constraint("ck_barbers_position", type_="check")
    with op.batch_alter_table("services") as batch:
        batch.drop_constraint("ck_services_duration", type_="check")
        batch.drop_constraint("ck_services_price_cents", type_="check")
