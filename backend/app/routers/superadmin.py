from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.middleware.dependencies import require_superadmin
from app.models.user import User, UserRole
from app.models.complaint import Complaint, ComplaintStatus, ComplaintCategory, ComplaintPriority
from app.models.tracking import Approval, ApprovalStatus, AuditLog
from app.services import notification_service

router = APIRouter(prefix="/api/superadmin", tags=["superadmin"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class ApprovalOut(BaseModel):
    id: int
    complaint_id: int
    admin_id: int | None
    admin_notes: str | None
    admin_approved_at: datetime | None
    superadmin_id: int | None
    superadmin_decision: str | None
    superadmin_approved_at: datetime | None
    status: ApprovalStatus

    model_config = {"from_attributes": True}


class PendingApprovalItem(BaseModel):
    id: int
    reference_id: str
    category: ComplaintCategory
    priority: ComplaintPriority
    plant: str
    submitter_name: str
    submitter_employee_id: str
    description: str
    created_at: datetime
    updated_at: datetime
    approval: ApprovalOut | None

    model_config = {"from_attributes": True}


class ApproveIn(BaseModel):
    notes: str | None = None


class RejectIn(BaseModel):
    notes: str


class ComplaintListItem(BaseModel):
    id: int
    reference_id: str
    category: ComplaintCategory
    status: ComplaintStatus
    priority: ComplaintPriority
    plant: str
    submitter_name: str
    submitter_employee_id: str
    ai_classification: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Routes ──────────────────────────────────────────────────────────────────────

@router.get("/approvals", response_model=dict)
async def list_pending_approvals(
    current_user: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """List all complaints awaiting superadmin approval."""
    result = await db.execute(
        select(Complaint)
        .options(selectinload(Complaint.approval))
        .where(Complaint.status == ComplaintStatus.awaiting_approval)
        .order_by(Complaint.updated_at.desc())
    )
    complaints = result.scalars().all()

    items = [PendingApprovalItem.model_validate(c).model_dump() for c in complaints]
    return {"success": True, "data": {"items": items, "total": len(items)}}


@router.get("/approvals/count", response_model=dict)
async def approval_count(
    current_user: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Returns count of pending approvals — used by sidebar badge."""
    result = await db.execute(
        select(func.count()).where(Complaint.status == ComplaintStatus.awaiting_approval)
    )
    count = result.scalar_one()
    return {"success": True, "data": {"count": count}}


@router.patch("/complaints/{id}/approve", response_model=dict)
async def approve_complaint(
    id: int,
    body: ApproveIn,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    complaint = await _get_complaint_or_404(id, db)
    if complaint.status != ComplaintStatus.awaiting_approval:
        raise HTTPException(status_code=400, detail="Complaint is not awaiting approval")

    # Update or create Approval record
    approval = complaint.approval
    if approval is None:
        approval = Approval(
            complaint_id=complaint.id,
            status=ApprovalStatus.approved,
        )
        db.add(approval)
    approval.superadmin_id = current_user.id
    approval.superadmin_approved_at = datetime.utcnow()
    approval.superadmin_decision = "approved"
    approval.status = ApprovalStatus.approved

    complaint.status = ComplaintStatus.resolved
    complaint.closed_at = datetime.utcnow()

    audit = AuditLog(
        complaint_id=complaint.id,
        user_id=current_user.id,
        action="superadmin_approved",
        details={"notes": body.notes, "by": current_user.full_name},
    )
    db.add(audit)
    await db.commit()
    await db.refresh(complaint)

    if complaint.submitter_email:
        background_tasks.add_task(
            notification_service.notify_worker,
            "resolved",
            complaint.submitter_email,
            complaint.reference_id,
            complaint.tracking_token,
        )

    return {"success": True, "data": {"status": complaint.status}, "message": "Complaint approved and resolved"}


@router.patch("/complaints/{id}/reject", response_model=dict)
async def reject_complaint(
    id: int,
    body: RejectIn,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    complaint = await _get_complaint_or_404(id, db)
    if complaint.status != ComplaintStatus.awaiting_approval:
        raise HTTPException(status_code=400, detail="Complaint is not awaiting approval")

    approval = complaint.approval
    if approval is None:
        approval = Approval(complaint_id=complaint.id)
        db.add(approval)
    approval.superadmin_id = current_user.id
    approval.superadmin_approved_at = datetime.utcnow()
    approval.superadmin_decision = "rejected"
    approval.status = ApprovalStatus.rejected

    # Send back to in_progress so admin can act on rejection notes
    complaint.status = ComplaintStatus.in_progress

    audit = AuditLog(
        complaint_id=complaint.id,
        user_id=current_user.id,
        action="superadmin_rejected",
        details={"notes": body.notes, "by": current_user.full_name},
    )
    db.add(audit)
    await db.commit()
    await db.refresh(complaint)

    return {
        "success": True,
        "data": {"status": complaint.status},
        "message": "Complaint rejected — returned to In Progress",
    }


@router.get("/complaints", response_model=dict)
async def list_all_complaints(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: ComplaintStatus | None = Query(None),
    plant: str | None = Query(None),
    search: str | None = Query(None),
    current_user: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Global complaints view — all plants."""
    base = select(Complaint)
    if status:
        base = base.where(Complaint.status == status)
    if plant:
        base = base.where(Complaint.plant == plant)
    if search:
        term = f"%{search}%"
        base = base.where(
            or_(
                Complaint.reference_id.ilike(term),
                Complaint.submitter_name.ilike(term),
                Complaint.submitter_employee_id.ilike(term),
            )
        )

    total_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_result.scalar_one()

    offset = (page - 1) * page_size
    result = await db.execute(
        base.order_by(Complaint.created_at.desc()).offset(offset).limit(page_size)
    )
    complaints = result.scalars().all()

    return {
        "success": True,
        "data": {
            "items": [ComplaintListItem.model_validate(c).model_dump() for c in complaints],
            "total": total,
            "page": page,
            "pages": max(1, -(-total // page_size)),
        },
    }


@router.get("/stats", response_model=dict)
async def global_stats(
    current_user: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Global stats across all plants."""
    async def count_where(*filters):
        q = select(func.count(Complaint.id))
        for f in filters:
            q = q.where(f)
        return (await db.execute(q)).scalar_one()

    total = await count_where()
    pending = await count_where(Complaint.status == ComplaintStatus.new)
    in_progress = await count_where(Complaint.status == ComplaintStatus.in_progress)
    awaiting = await count_where(Complaint.status == ComplaintStatus.awaiting_approval)
    resolved = await count_where(Complaint.status == ComplaintStatus.resolved)

    # Per-plant breakdown
    plant_q = await db.execute(
        select(Complaint.plant, func.count(Complaint.id))
        .group_by(Complaint.plant)
        .order_by(func.count(Complaint.id).desc())
    )
    plant_breakdown = [{"plant": row[0], "count": row[1]} for row in plant_q.all()]

    return {
        "success": True,
        "data": {
            "total": total,
            "pending": pending,
            "in_progress": in_progress,
            "awaiting_approval": awaiting,
            "resolved": resolved,
            "plant_breakdown": plant_breakdown,
        },
    }


# ── Helpers ─────────────────────────────────────────────────────────────────────

async def _get_complaint_or_404(id: int, db: AsyncSession) -> Complaint:
    result = await db.execute(
        select(Complaint)
        .options(selectinload(Complaint.approval))
        .where(Complaint.id == id)
    )
    complaint = result.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return complaint
