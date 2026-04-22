"""remove pending status — migrate to new

Revision ID: 0007
Revises: 0006
Create Date: 2026-04-11
"""
from alembic import op

revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Move all existing 'pending' complaints to 'new'
    op.execute("UPDATE complaints SET status = 'new' WHERE status = 'pending'")

    # Drop the column default before swapping the type
    op.execute("ALTER TABLE complaints ALTER COLUMN status DROP DEFAULT")

    # Recreate the enum without 'pending'
    op.execute("ALTER TYPE complaintstatus RENAME TO complaintstatus_old")
    op.execute("""
        CREATE TYPE complaintstatus AS ENUM (
            'new',
            'in_progress',
            'vendor_pending',
            'awaiting_approval',
            'escalated',
            'resolved',
            'closed'
        )
    """)
    op.execute("""
        ALTER TABLE complaints
        ALTER COLUMN status TYPE complaintstatus
        USING status::text::complaintstatus
    """)
    op.execute("DROP TYPE complaintstatus_old")

    # Restore the default with the new type
    op.execute("ALTER TABLE complaints ALTER COLUMN status SET DEFAULT 'new'")


def downgrade() -> None:
    op.execute("ALTER TYPE complaintstatus RENAME TO complaintstatus_old")
    op.execute("""
        CREATE TYPE complaintstatus AS ENUM (
            'new',
            'pending',
            'in_progress',
            'vendor_pending',
            'awaiting_approval',
            'escalated',
            'resolved',
            'closed'
        )
    """)
    op.execute("""
        ALTER TABLE complaints
        ALTER COLUMN status TYPE complaintstatus
        USING status::text::complaintstatus
    """)
    op.execute("DROP TYPE complaintstatus_old")
