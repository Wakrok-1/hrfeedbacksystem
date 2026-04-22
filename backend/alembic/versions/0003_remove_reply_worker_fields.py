"""remove worker_accepted, worker_response, loop_count from replies

Revision ID: 0003_remove_reply_worker_fields
Revises: 965651cf9687
Create Date: 2026-03-29
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_remove_reply_worker_fields"
down_revision = "965651cf9687"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("replies", "worker_accepted")
    op.drop_column("replies", "worker_response")
    op.drop_column("replies", "loop_count")


def downgrade() -> None:
    op.add_column("replies", sa.Column("loop_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("replies", sa.Column("worker_response", sa.Text(), nullable=True))
    op.add_column("replies", sa.Column("worker_accepted", sa.Boolean(), nullable=True))
