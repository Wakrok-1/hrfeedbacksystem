import enum
import secrets
from datetime import datetime, timedelta
from sqlalchemy import String, Text, Boolean, DateTime, Enum, ForeignKey, Integer, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ApprovalStatus(str, enum.Enum):
    pending_admin = "pending_admin"
    pending_superadmin = "pending_superadmin"
    approved = "approved"
    rejected = "rejected"


class Approval(Base):
    __tablename__ = "approvals"

    id: Mapped[int] = mapped_column(primary_key=True)
    complaint_id: Mapped[int] = mapped_column(ForeignKey("complaints.id"), unique=True, nullable=False)
    admin_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    superadmin_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    admin_approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    admin_notes: Mapped[str | None] = mapped_column(Text)
    superadmin_approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    superadmin_decision: Mapped[str | None] = mapped_column(String(20))  # approved / rejected
    status: Mapped[ApprovalStatus] = mapped_column(
        Enum(ApprovalStatus), nullable=False, default=ApprovalStatus.pending_admin
    )

    complaint: Mapped["Complaint"] = relationship("Complaint", back_populates="approval")  # type: ignore[name-defined]
    admin: Mapped["User | None"] = relationship("User", foreign_keys=[admin_id])  # type: ignore[name-defined]
    superadmin: Mapped["User | None"] = relationship("User", foreign_keys=[superadmin_id])  # type: ignore[name-defined]


class Reply(Base):
    __tablename__ = "replies"

    id: Mapped[int] = mapped_column(primary_key=True)
    complaint_id: Mapped[int] = mapped_column(ForeignKey("complaints.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    generated_by_ai: Mapped[bool] = mapped_column(Boolean, default=False)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_by_admin_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    complaint: Mapped["Complaint"] = relationship("Complaint", back_populates="replies")  # type: ignore[name-defined]
    sent_by: Mapped["User | None"] = relationship("User", foreign_keys=[sent_by_admin_id])  # type: ignore[name-defined]


class SLATracking(Base):
    __tablename__ = "sla_tracking"

    id: Mapped[int] = mapped_column(primary_key=True)
    complaint_id: Mapped[int] = mapped_column(ForeignKey("complaints.id"), unique=True, nullable=False)
    vendor_response_id: Mapped[int | None] = mapped_column(ForeignKey("vendor_responses.id"), nullable=True)
    reminder_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    escalation_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    vendor_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # +2 days from forwarded
    escalation_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # +7 days
    is_escalated: Mapped[bool] = mapped_column(Boolean, default=False)

    complaint: Mapped["Complaint"] = relationship("Complaint", back_populates="sla_tracking")  # type: ignore[name-defined]


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    complaint_id: Mapped[int | None] = mapped_column(ForeignKey("complaints.id"), nullable=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    details: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    complaint: Mapped["Complaint | None"] = relationship("Complaint", back_populates="audit_logs")  # type: ignore[name-defined]


class VendorDeviceToken(Base):
    __tablename__ = "vendor_device_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    @staticmethod
    def generate(vendor_id: int) -> "VendorDeviceToken":
        return VendorDeviceToken(
            vendor_id=vendor_id,
            token=secrets.token_hex(32),
            expires_at=datetime.utcnow() + timedelta(days=30),
        )
