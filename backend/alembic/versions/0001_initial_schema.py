"""Initial schema

Revision ID: 0001
Revises:
Create Date: 2026-03-28

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Enums ---
    op.execute("CREATE TYPE userrole AS ENUM ('admin', 'superadmin', 'vendor')")
    op.execute("CREATE TYPE complaintcategory AS ENUM ('Canteen', 'Locker', 'ESD', 'Transportation')")
    op.execute("CREATE TYPE complaintstatus AS ENUM ('pending', 'in_progress', 'vendor_pending', 'awaiting_approval', 'resolved', 'closed')")
    op.execute("CREATE TYPE complaintpriority AS ENUM ('normal', 'urgent')")
    op.execute("CREATE TYPE vendorresponsestatus AS ENUM ('pending', 'submitted', 'approved', 'rejected')")
    op.execute("CREATE TYPE approvalstatus AS ENUM ('pending_admin', 'pending_superadmin', 'approved', 'rejected')")

    # --- Departments ---
    op.create_table(
        "departments",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("plant", sa.String(10), nullable=False),
        sa.Column("vendor_email", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- Users ---
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(150), nullable=False),
        sa.Column("role", postgresql.ENUM("admin", "superadmin", "vendor", name="userrole", create_type=False), nullable=False),
        sa.Column("department_id", sa.Integer, sa.ForeignKey("departments.id"), nullable=True),
        sa.Column("plant", sa.String(10)),
        sa.Column("is_active", sa.Boolean, default=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # --- Complaints ---
    op.create_table(
        "complaints",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("reference_id", sa.String(20), unique=True, nullable=False),
        sa.Column("tracking_token", sa.String(36), unique=True, nullable=False),
        sa.Column("category", postgresql.ENUM("Canteen", "Locker", "ESD", "Transportation", name="complaintcategory", create_type=False), nullable=False),
        sa.Column("status", postgresql.ENUM("pending", "in_progress", "vendor_pending", "awaiting_approval", "resolved", "closed", name="complaintstatus", create_type=False), nullable=False, server_default="pending"),
        sa.Column("priority", postgresql.ENUM("normal", "urgent", name="complaintpriority", create_type=False), nullable=False, server_default="normal"),
        sa.Column("plant", sa.String(10), nullable=False),
        sa.Column("submitter_name", sa.String(150), nullable=False),
        sa.Column("submitter_employee_id", sa.String(50), nullable=False),
        sa.Column("submitter_email", sa.String(255)),
        sa.Column("submitter_phone", sa.String(30)),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("department_id", sa.Integer, sa.ForeignKey("departments.id"), nullable=True),
        sa.Column("assigned_admin_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("category_data", postgresql.JSONB),
        sa.Column("ai_classification", sa.String(100)),
        sa.Column("ai_priority", sa.String(20)),
        sa.Column("ai_sentiment", sa.Float),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("closed_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_complaints_reference_id", "complaints", ["reference_id"])
    op.create_index("ix_complaints_tracking_token", "complaints", ["tracking_token"])

    # --- Attachments ---
    op.create_table(
        "attachments",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("complaint_id", sa.Integer, sa.ForeignKey("complaints.id"), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("file_url", sa.String(1000), nullable=False),
        sa.Column("file_type", sa.String(50), nullable=False),
        sa.Column("file_size_mb", sa.Float, nullable=False),
        sa.Column("uploaded_by_role", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- Vendor responses ---
    op.create_table(
        "vendor_responses",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("complaint_id", sa.Integer, sa.ForeignKey("complaints.id"), nullable=False),
        sa.Column("vendor_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("response_notes", sa.Text),
        sa.Column("status", postgresql.ENUM("pending", "submitted", "approved", "rejected", name="vendorresponsestatus", create_type=False), nullable=False, server_default="pending"),
        sa.Column("submitted_at", sa.DateTime(timezone=True)),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("reviewed_by_admin_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
    )

    # --- Vendor attachments ---
    op.create_table(
        "vendor_attachments",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("vendor_response_id", sa.Integer, sa.ForeignKey("vendor_responses.id"), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("file_url", sa.String(1000), nullable=False),
        sa.Column("file_type", sa.String(50), nullable=False),
        sa.Column("file_size_mb", sa.Float, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # --- Approvals ---
    op.create_table(
        "approvals",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("complaint_id", sa.Integer, sa.ForeignKey("complaints.id"), unique=True, nullable=False),
        sa.Column("admin_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("superadmin_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("admin_approved_at", sa.DateTime(timezone=True)),
        sa.Column("admin_notes", sa.Text),
        sa.Column("superadmin_approved_at", sa.DateTime(timezone=True)),
        sa.Column("superadmin_decision", sa.String(20)),
        sa.Column("status", postgresql.ENUM("pending_admin", "pending_superadmin", "approved", "rejected", name="approvalstatus", create_type=False), nullable=False, server_default="pending_admin"),
    )

    # --- Replies ---
    op.create_table(
        "replies",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("complaint_id", sa.Integer, sa.ForeignKey("complaints.id"), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("generated_by_ai", sa.Boolean, default=False),
        sa.Column("sent_at", sa.DateTime(timezone=True)),
        sa.Column("sent_by_admin_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("worker_accepted", sa.Boolean),
        sa.Column("worker_response", sa.Text),
        sa.Column("loop_count", sa.Integer, default=0),
    )

    # --- SLA tracking ---
    op.create_table(
        "sla_tracking",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("complaint_id", sa.Integer, sa.ForeignKey("complaints.id"), unique=True, nullable=False),
        sa.Column("vendor_response_id", sa.Integer, sa.ForeignKey("vendor_responses.id"), nullable=True),
        sa.Column("reminder_sent_at", sa.DateTime(timezone=True)),
        sa.Column("escalation_sent_at", sa.DateTime(timezone=True)),
        sa.Column("vendor_deadline", sa.DateTime(timezone=True)),
        sa.Column("escalation_deadline", sa.DateTime(timezone=True)),
        sa.Column("is_escalated", sa.Boolean, default=False),
    )

    # --- Reports ---
    op.create_table(
        "reports",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("content", postgresql.JSONB, nullable=False),
        sa.Column("sent_to", postgresql.ARRAY(sa.String)),
        sa.Column("created_by", sa.Integer, nullable=True),
    )

    # --- Audit logs ---
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("complaint_id", sa.Integer, sa.ForeignKey("complaints.id"), nullable=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("details", postgresql.JSONB),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("reports")
    op.drop_table("sla_tracking")
    op.drop_table("replies")
    op.drop_table("approvals")
    op.drop_table("vendor_attachments")
    op.drop_table("vendor_responses")
    op.drop_table("attachments")
    op.drop_table("complaints")
    op.drop_table("users")
    op.drop_table("departments")
    op.execute("DROP TYPE IF EXISTS approvalstatus")
    op.execute("DROP TYPE IF EXISTS vendorresponsestatus")
    op.execute("DROP TYPE IF EXISTS complaintpriority")
    op.execute("DROP TYPE IF EXISTS complaintstatus")
    op.execute("DROP TYPE IF EXISTS complaintcategory")
    op.execute("DROP TYPE IF EXISTS userrole")
