from fastapi import APIRouter, Cookie, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.middleware.dependencies import require_vendor
from app.models.user import User
from app.models.complaint import Complaint, ComplaintStatus, ComplaintCategory, ComplaintPriority
from app.models.tracking import AuditLog, VendorDeviceToken
from app.schemas.complaint import ComplaintOut

router = APIRouter(prefix="/api/vendor", tags=["vendor"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class VendorComplaintListItem(BaseModel):
    id: int
    reference_id: str
    category: ComplaintCategory
    status: ComplaintStatus
    priority: ComplaintPriority
    plant: str
    submitter_name: str
    description: str
    created_at: datetime
    updated_at: datetime
    attachment_count: int = 0
    response_count: int = 0
    model_config = {"from_attributes": True}


class VendorComplaintDetail(ComplaintOut):
    assigned_vendor_id: int | None
    audit_logs: list[dict] = []


class ResponseIn(BaseModel):
    content: str
    action_taken: str | None = None
    attachment_urls: list[str] = []


class VendorStatsResponse(BaseModel):
    total: int
    pending: int
    in_progress: int
    resolved: int


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _get_assigned_or_404(id: int, current_user: User, db: AsyncSession) -> Complaint:
    result = await db.execute(
        select(Complaint)
        .options(selectinload(Complaint.attachments), selectinload(Complaint.audit_logs))
        .where(Complaint.id == id, Complaint.assigned_vendor_id == current_user.id)
    )
    complaint = result.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return complaint


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=dict)
async def get_stats(
    current_user: User = Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    base = select(Complaint).where(Complaint.assigned_vendor_id == current_user.id)

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    pending = (await db.execute(select(func.count()).select_from(
        base.where(Complaint.status == ComplaintStatus.new).subquery()
    ))).scalar_one()
    in_progress = (await db.execute(select(func.count()).select_from(
        base.where(Complaint.status == ComplaintStatus.in_progress).subquery()
    ))).scalar_one()
    resolved = (await db.execute(select(func.count()).select_from(
        base.where(Complaint.status == ComplaintStatus.resolved).subquery()
    ))).scalar_one()

    return {"success": True, "data": {"total": total, "pending": pending, "in_progress": in_progress, "resolved": resolved}}


@router.get("/complaints", response_model=dict)
async def list_complaints(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: ComplaintStatus | None = Query(None),
    current_user: User = Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    base = (
        select(Complaint)
        .options(selectinload(Complaint.attachments), selectinload(Complaint.audit_logs))
        .where(Complaint.assigned_vendor_id == current_user.id)
    )
    if status:
        base = base.where(Complaint.status == status)

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    offset = (page - 1) * page_size
    result = await db.execute(base.order_by(Complaint.created_at.desc()).offset(offset).limit(page_size))
    complaints = result.scalars().all()

    # Count vendor responses per complaint
    items = []
    for c in complaints:
        response_count = sum(1 for log in c.audit_logs if log.action == "vendor_response") if hasattr(c, "audit_logs") else 0
        items.append(VendorComplaintListItem(
            **{k: getattr(c, k) for k in VendorComplaintListItem.model_fields if hasattr(c, k)},
            attachment_count=len(c.attachments),
            response_count=response_count,
        ).model_dump())

    return {
        "success": True,
        "data": {
            "items": items,
            "total": total,
            "page": page,
            "pages": max(1, -(-total // page_size)),
        },
    }


@router.get("/complaints/{id}", response_model=dict)
async def get_complaint(
    id: int,
    current_user: User = Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    complaint = await _get_assigned_or_404(id, current_user, db)
    data = ComplaintOut.model_validate(complaint).model_dump()
    data["assigned_vendor_id"] = complaint.assigned_vendor_id
    data["audit_logs"] = [
        {
            "id": log.id,
            "action": log.action,
            "details": log.details,
            "created_at": log.created_at.isoformat(),
        }
        for log in complaint.audit_logs
    ]
    return {"success": True, "data": data}


@router.post("/complaints/{id}/response", response_model=dict)
async def submit_response(
    id: int,
    body: ResponseIn,
    current_user: User = Depends(require_vendor),
    db: AsyncSession = Depends(get_db),
):
    complaint = await _get_assigned_or_404(id, current_user, db)

    details: dict = {"response": body.content, "by": current_user.full_name}
    if body.action_taken:
        details["action_taken"] = body.action_taken
    if body.attachment_urls:
        details["attachment_urls"] = body.attachment_urls

    audit = AuditLog(
        complaint_id=complaint.id,
        user_id=current_user.id,
        action="vendor_response",
        details=details,
    )
    db.add(audit)

    # Move status to in_progress if still pending
    if complaint.status == ComplaintStatus.new:
        complaint.status = ComplaintStatus.in_progress

    await db.commit()
    await db.refresh(audit)

    return {"success": True, "data": {"id": audit.id, "created_at": audit.created_at.isoformat()}, "message": "Response submitted"}


# ── Case preview via device token (no full auth required) ─────────────────────

@router.get("/case-preview/{case_id}", response_model=dict)
async def case_preview(
    case_id: int,
    vendor_device_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns a read-only case summary using the vendor's 30-day device token cookie.
    No JWT required — intended for direct links sent to vendor's phone/browser.
    """
    if not vendor_device_token:
        raise HTTPException(status_code=401, detail="Device token required")

    # Validate token
    token_result = await db.execute(
        select(VendorDeviceToken).where(VendorDeviceToken.token == vendor_device_token)
    )
    device = token_result.scalar_one_or_none()

    if not device:
        raise HTTPException(status_code=401, detail="Invalid device token")
    if device.expires_at < datetime.utcnow():
        raise HTTPException(status_code=401, detail="Device token expired — please log in again")

    # Update last_used_at
    device.last_used_at = datetime.utcnow()

    # Fetch the complaint — must be assigned to this vendor
    result = await db.execute(
        select(Complaint)
        .options(selectinload(Complaint.attachments), selectinload(Complaint.audit_logs))
        .where(Complaint.id == case_id, Complaint.assigned_vendor_id == device.vendor_id)
    )
    complaint = result.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail="Case not found or not assigned to you")

    await db.commit()

    return {
        "success": True,
        "data": {
            "id": complaint.id,
            "reference_id": complaint.reference_id,
            "category": complaint.category.value,
            "status": complaint.status.value,
            "priority": complaint.priority.value,
            "plant": complaint.plant,
            "description": complaint.description,
            "created_at": complaint.created_at.isoformat(),
            "updated_at": complaint.updated_at.isoformat(),
            "attachments": [
                {"file_name": a.file_name, "file_url": a.file_url, "file_type": a.file_type, "file_size_mb": a.file_size_mb}
                for a in complaint.attachments
            ],
            "responses": [
                {
                    "id": log.id,
                    "details": log.details,
                    "created_at": log.created_at.isoformat(),
                }
                for log in complaint.audit_logs
                if log.action == "vendor_response"
            ],
        },
    }
