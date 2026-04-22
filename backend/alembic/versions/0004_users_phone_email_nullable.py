"""make users.email nullable, add users.phone

Revision ID: 0004_users_phone_email_nullable
Revises: 0003_remove_reply_worker_fields
Create Date: 2026-03-31
"""
from alembic import op
import sqlalchemy as sa

revision = "0004_users_phone_email_nullable"
down_revision = "0003_remove_reply_worker_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make email nullable (vendors won't have one)
    op.alter_column("users", "email", nullable=True)

    # Add phone column (unique, nullable — required for vendors)
    op.add_column("users", sa.Column("phone", sa.String(30), nullable=True))
    op.create_unique_constraint("uq_users_phone", "users", ["phone"])
    op.create_index("ix_users_phone", "users", ["phone"])


def downgrade() -> None:
    op.drop_index("ix_users_phone", table_name="users")
    op.drop_constraint("uq_users_phone", "users", type_="unique")
    op.drop_column("users", "phone")
    op.alter_column("users", "email", nullable=False)
