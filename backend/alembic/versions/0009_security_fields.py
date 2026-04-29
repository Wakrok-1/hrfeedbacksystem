"""Add security fields to users table

Revision ID: 0009
Revises: 0008
Create Date: 2026-04-29
"""
from alembic import op
import sqlalchemy as sa

revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # token_version — incremented on logout to invalidate all existing JWTs
    op.add_column('users', sa.Column('token_version', sa.Integer(), nullable=False, server_default='0'))
    # login_attempts + locked_until — account lockout after repeated failures
    op.add_column('users', sa.Column('login_attempts', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'locked_until')
    op.drop_column('users', 'login_attempts')
    op.drop_column('users', 'token_version')
