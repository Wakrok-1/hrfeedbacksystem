"""add category to users

Revision ID: 0008
Revises: 0007
Create Date: 2026-04-11
"""
from alembic import op
import sqlalchemy as sa

revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('category', sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'category')
