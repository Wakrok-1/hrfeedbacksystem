"""create vendor_device_tokens table

Revision ID: 0005_vendor_device_tokens
Revises: 0004_users_phone_email_nullable
Create Date: 2026-03-31
"""
from alembic import op
import sqlalchemy as sa

revision = "0005_vendor_device_tokens"
down_revision = "0004_users_phone_email_nullable"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vendor_device_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("vendor_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", sa.String(64), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_vendor_device_tokens_token", "vendor_device_tokens", ["token"])
    op.create_index("ix_vendor_device_tokens_vendor_id", "vendor_device_tokens", ["vendor_id"])


def downgrade() -> None:
    op.drop_index("ix_vendor_device_tokens_vendor_id", table_name="vendor_device_tokens")
    op.drop_index("ix_vendor_device_tokens_token", table_name="vendor_device_tokens")
    op.drop_table("vendor_device_tokens")
