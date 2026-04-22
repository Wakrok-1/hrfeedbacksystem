import enum
from datetime import datetime
from sqlalchemy import String, Text, Boolean, DateTime, Enum, ForeignKey, Integer, Float, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ComplaintCategory(str, enum.Enum):
    canteen = "Canteen"
    locker = "Locker"
    esd = "ESD"
    transportation = "Transportation"


class ComplaintStatus(str, enum.Enum):
    new = "new"
    in_progress = "in_progress"
    vendor_pending = "vendor_pending"
    awaiting_approval = "awaiting_approval"
    escalated = "escalated"
    resolved = "resolved"
    closed = "closed"


class ComplaintPriority(str, enum.Enum):
    normal = "normal"
    urgent = "urgent"


class Complaint(Base):
    __tablename__ = "complaints"

    id: Mapped[int] = mapped_column(primary_key=True)
    reference_id: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    tracking_token: Mapped[str] = mapped_column(String(36), unique=True, nullable=False, index=True)

    category: Mapped[ComplaintCategory] = mapped_column(Enum(ComplaintCategory, values_callable=lambda x: [e.value for e in x]), nullable=False)
    status: Mapped[ComplaintStatus] = mapped_column(
        Enum(ComplaintStatus, values_callable=lambda x: [e.value for e in x]), nullable=False, default=ComplaintStatus.new
    )
    priority: Mapped[ComplaintPriority] = mapped_column(
        Enum(ComplaintPriority, values_callable=lambda x: [e.value for e in x]), nullable=False, default=ComplaintPriority.normal
    )
    plant: Mapped[str] = mapped_column(String(10), nullable=False)

    submitter_name: Mapped[str] = mapped_column(String(150), nullable=False)
    submitter_employee_id: Mapped[str] = mapped_column(String(50), nullable=False)
    submitter_email: Mapped[str | None] = mapped_column(String(255))
    submitter_phone: Mapped[str | None] = mapped_column(String(30))

    description: Mapped[str] = mapped_column(Text, nullable=False)
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"), nullable=True)
    assigned_admin_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    assigned_vendor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    # Category-specific extra fields stored as JSONB
    category_data: Mapped[dict | None] = mapped_column(JSONB)

    # AI fields — populated asynchronously
    ai_classification: Mapped[str | None] = mapped_column(String(100))
    ai_priority: Mapped[str | None] = mapped_column(String(20))
    ai_sentiment: Mapped[float | None] = mapped_column(Float)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    department: Mapped["Department | None"] = relationship("Department", back_populates="complaints")  # type: ignore[name-defined]
    assigned_admin: Mapped["User | None"] = relationship("User", foreign_keys=[assigned_admin_id])  # type: ignore[name-defined]
    attachments: Mapped[list["Attachment"]] = relationship("Attachment", back_populates="complaint")
    vendor_responses: Mapped[list["VendorResponse"]] = relationship("VendorResponse", back_populates="complaint")
    approval: Mapped["Approval | None"] = relationship("Approval", back_populates="complaint", uselist=False)
    replies: Mapped[list["Reply"]] = relationship("Reply", back_populates="complaint")
    sla_tracking: Mapped["SLATracking | None"] = relationship("SLATracking", back_populates="complaint", uselist=False)
    audit_logs: Mapped[list["AuditLog"]] = relationship("AuditLog", back_populates="complaint")


class Attachment(Base):
    __tablename__ = "attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    complaint_id: Mapped[int] = mapped_column(ForeignKey("complaints.id"), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)
    file_size_mb: Mapped[float] = mapped_column(Float, nullable=False)
    uploaded_by_role: Mapped[str] = mapped_column(String(20), nullable=False)  # public / admin / vendor
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    complaint: Mapped["Complaint"] = relationship("Complaint", back_populates="attachments")
