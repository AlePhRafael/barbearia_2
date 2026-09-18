"""Initial persistent catalog, booking and staff schema."""
from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None


def upgrade():
    op.create_table("services", sa.Column("id", sa.String, primary_key=True),
        sa.Column("name", sa.String, nullable=False), sa.Column("description", sa.Text, nullable=False),
        sa.Column("icon", sa.String, nullable=False), sa.Column("price_cents", sa.Integer, nullable=False),
        sa.Column("duration", sa.Integer, nullable=False))
    op.create_table("barbers", sa.Column("id", sa.String, primary_key=True),
        sa.Column("name", sa.String, nullable=False), sa.Column("specialty", sa.String, nullable=False),
        sa.Column("rating", sa.String, nullable=False), sa.Column("position", sa.Integer, nullable=False))
    op.create_table("appointments", sa.Column("id", sa.String, primary_key=True),
        sa.Column("name", sa.String, nullable=False), sa.Column("phone", sa.String, nullable=False),
        sa.Column("note", sa.Text, nullable=False), sa.Column("barber", sa.String, sa.ForeignKey("barbers.id"), nullable=False),
        sa.Column("date", sa.String, nullable=False), sa.Column("time", sa.String, nullable=False),
        sa.Column("start_minute", sa.Integer, nullable=False), sa.Column("duration", sa.Integer, nullable=False),
        sa.Column("total_cents", sa.Integer, nullable=False), sa.Column("status", sa.String, nullable=False),
        sa.Column("idempotency_key", sa.String, nullable=False, unique=True), sa.Column("request_hash", sa.String, nullable=False))
    op.create_index("ix_appointments_date_barber", "appointments", ["date", "barber"])
    op.create_table("appointment_items", sa.Column("appointment_id", sa.String, sa.ForeignKey("appointments.id"), primary_key=True),
        sa.Column("service_id", sa.String, sa.ForeignKey("services.id"), primary_key=True), sa.Column("name", sa.String, nullable=False),
        sa.Column("price_cents", sa.Integer, nullable=False), sa.Column("duration", sa.Integer, nullable=False))
    op.create_table("users", sa.Column("username", sa.String, primary_key=True), sa.Column("password_hash", sa.String, nullable=False))
    op.create_table("sessions", sa.Column("token_hash", sa.String, primary_key=True),
        sa.Column("username", sa.String, sa.ForeignKey("users.username"), nullable=False), sa.Column("expires_at", sa.Integer, nullable=False))


def downgrade():
    for table in ("sessions", "users", "appointment_items", "appointments", "barbers", "services"):
        op.drop_table(table)
