import enum
from datetime import datetime
from sqlalchemy import String, Text, DateTime, Enum, ForeignKey, Float, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class VendorResponseStatus(str, enum.Enum):
    pending = "pending"
    submitted = "submitted"
    approved = "approved"
    rejected = "rejected"


class VendorResponse(Base):
    __tablename__ = "vendor_responses"

    id: Mapped[int] = mapped_column(primary_key=True)
    complaint_id: Mapped[int] = mapped_column(ForeignKey("complaints.id"), nullable=False)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    response_notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[VendorResponseStatus] = mapped_column(
        Enum(VendorResponseStatus), nullable=False, default=VendorResponseStatus.pending
    )
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_by_admin_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    complaint: Mapped["Complaint"] = relationship("Complaint", back_populates="vendor_responses")  # type: ignore[name-defined]
    vendor: Mapped["User"] = relationship("User", foreign_keys=[vendor_id])  # type: ignore[name-defined]
    reviewed_by: Mapped["User | None"] = relationship("User", foreign_keys=[reviewed_by_admin_id])  # type: ignore[name-defined]
    attachments: Mapped[list["VendorAttachment"]] = relationship("VendorAttachment", back_populates="vendor_response")


class VendorAttachment(Base):
    __tablename__ = "vendor_attachments"

    id: Mapped[int] = mapped_column(primary_key=True)
    vendor_response_id: Mapped[int] = mapped_column(ForeignKey("vendor_responses.id"), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)
    file_size_mb: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    vendor_response: Mapped["VendorResponse"] = relationship("VendorResponse", back_populates="attachments")
