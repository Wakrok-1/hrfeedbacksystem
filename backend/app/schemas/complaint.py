from pydantic import BaseModel, EmailStr, field_validator
from typing import Any
from datetime import datetime
from app.models.complaint import ComplaintCategory, ComplaintStatus, ComplaintPriority


class ComplaintSubmit(BaseModel):
    # Personal info
    submitter_name: str
    submitter_employee_id: str
    submitter_email: EmailStr | None = None
    submitter_phone: str | None = None
    plant: str  # P1 / P2 / BK

    # Complaint
    category: ComplaintCategory
    description: str
    category_data: dict[str, Any] | None = None  # category-specific fields

    # Pre-uploaded file URLs (from /api/upload/complaint)
    attachment_urls: list[dict[str, Any]] | None = None  # [{file_name, file_url, file_type, file_size_mb}]

    @field_validator("description")
    @classmethod
    def description_max(cls, v: str) -> str:
        if len(v) > 1000:
            raise ValueError("Description must be 1000 characters or less")
        return v

    @field_validator("plant")
    @classmethod
    def valid_plant(cls, v: str) -> str:
        if v not in ("P1", "P2", "BK"):
            raise ValueError("Plant must be P1, P2, or BK")
        return v


class AttachmentOut(BaseModel):
    id: int
    file_name: str
    file_url: str
    file_type: str
    file_size_mb: float
    created_at: datetime

    model_config = {"from_attributes": True}


class ComplaintOut(BaseModel):
    id: int
    reference_id: str
    tracking_token: str
    category: ComplaintCategory
    status: ComplaintStatus
    priority: ComplaintPriority
    plant: str
    submitter_name: str
    submitter_employee_id: str
    submitter_email: str | None
    submitter_phone: str | None
    description: str
    category_data: dict[str, Any] | None
    ai_classification: str | None
    ai_priority: str | None
    ai_sentiment: float | None
    created_at: datetime
    updated_at: datetime
    attachments: list[AttachmentOut] = []

    model_config = {"from_attributes": True}


class ComplaintSubmitResponse(BaseModel):
    reference_id: str
    tracking_token: str
    tracking_url: str
