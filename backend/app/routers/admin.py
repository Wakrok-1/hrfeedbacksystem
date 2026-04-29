import csv
import io
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from app.services.auth_service import hash_password, validate_password
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Any
from datetime import datetime

from app.config import settings
from app.database import get_db
from app.middleware.dependencies import require_admin
from app.models.user import User, UserRole
from app.models.complaint import Complaint, ComplaintStatus, ComplaintPriority, ComplaintCategory
from app.models.tracking import Approval, ApprovalStatus, AuditLog, Reply
from app.schemas.complaint import ComplaintOut, AttachmentOut
from app.services import notification_service
from app.services import ai_service

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class ComplaintListItem(BaseModel):
    id: int
    reference_id: str
    category: ComplaintCategory
    status: ComplaintStatus
    priority: ComplaintPriority
    plant: str
    submitter_name: str
    submitter_employee_id: str
    description: str
    ai_classification: str | None
    created_at: datetime
    updated_at: datetime
    attachment_count: int = 0

    model_config = {"from_attributes": True}


class ComplaintListResponse(BaseModel):
    items: list[ComplaintListItem]
    total: int
    pending: int
    in_progress: int
    resolved: int
    page: int
    pages: int


class NoteIn(BaseModel):
    content: str


class StatusIn(BaseModel):
    status: ComplaintStatus


class AssignVendorIn(BaseModel):
    vendor_id: int | None


class PriorityIn(BaseModel):
    priority: ComplaintPriority


class AuditLogOut(BaseModel):
    id: int
    action: str
    details: dict[str, Any] | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ComplaintDetailOut(ComplaintOut):
    assigned_admin_id: int | None
    audit_logs: list[AuditLogOut] = []


# ── Helpers ─────────────────────────────────────────────────────────────────────

def _scoped_query(current_user: User):
    """Superadmin sees all; admin sees only their plant (and category if set)."""
    q = select(Complaint).options(selectinload(Complaint.attachments))
    if current_user.role == UserRole.admin:
        q = q.where(Complaint.plant == current_user.plant)
        if current_user.category:
            q = q.where(Complaint.category == current_user.category)
    return q


async def _get_complaint_or_404(id: int, current_user: User, db: AsyncSession) -> Complaint:
    q = (
        select(Complaint)
        .options(
            selectinload(Complaint.attachments),
            selectinload(Complaint.audit_logs),
            selectinload(Complaint.approval),
        )
        .where(Complaint.id == id)
    )
    if current_user.role == UserRole.admin:
        q = q.where(Complaint.plant == current_user.plant)
        if current_user.category:
            q = q.where(Complaint.category == current_user.category)
    result = await db.execute(q)
    complaint = result.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return complaint


# ── Routes ──────────────────────────────────────────────────────────────────────

@router.get("/complaints", response_model=dict)
async def list_complaints(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: ComplaintStatus | None = Query(None),
    category: ComplaintCategory | None = Query(None),
    priority: ComplaintPriority | None = Query(None),
    plant: str | None = Query(None),
    search: str | None = Query(None),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    base = _scoped_query(current_user)

    # Filters
    if status:
        base = base.where(Complaint.status == status)
    if category:
        base = base.where(Complaint.category == category)
    if priority:
        base = base.where(Complaint.priority == priority)
    if plant and current_user.role == UserRole.superadmin:
        base = base.where(Complaint.plant == plant)
    if search:
        term = f"%{search}%"
        base = base.where(
            or_(
                Complaint.reference_id.ilike(term),
                Complaint.submitter_name.ilike(term),
                Complaint.submitter_employee_id.ilike(term),
                Complaint.description.ilike(term),
            )
        )

    # Stats (unfiltered by status/search, scoped by plant)
    stats_base = select(Complaint)
    if current_user.role == UserRole.admin:
        stats_base = stats_base.where(Complaint.plant == current_user.plant)
        if current_user.category:
            stats_base = stats_base.where(Complaint.category == current_user.category)

    total_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_result.scalar_one()

    new_q = await db.execute(select(func.count()).select_from(
        stats_base.where(Complaint.status == ComplaintStatus.new).subquery()
    ))
    pending_q = await db.execute(select(func.count()).select_from(
        stats_base.where(Complaint.status == ComplaintStatus.new).subquery()
    ))
    in_progress_q = await db.execute(select(func.count()).select_from(
        stats_base.where(Complaint.status == ComplaintStatus.in_progress).subquery()
    ))
    resolved_q = await db.execute(select(func.count()).select_from(
        stats_base.where(Complaint.status == ComplaintStatus.resolved).subquery()
    ))

    # Paginate
    offset = (page - 1) * page_size
    result = await db.execute(
        base.order_by(Complaint.created_at.desc()).offset(offset).limit(page_size)
    )
    complaints = result.scalars().all()

    items = [
        ComplaintListItem(
            **{c: getattr(complaint, c) for c in ComplaintListItem.model_fields if hasattr(complaint, c)},
            attachment_count=len(complaint.attachments),
        )
        for complaint in complaints
    ]

    return {
        "success": True,
        "data": {
            "items": [i.model_dump() for i in items],
            "total": total,
            "new": new_q.scalar_one(),
            "pending": pending_q.scalar_one(),
            "in_progress": in_progress_q.scalar_one(),
            "resolved": resolved_q.scalar_one(),
            "page": page,
            "pages": max(1, -(-total // page_size)),
        },
    }


@router.patch("/complaints/{id}/auto-open", response_model=dict)
async def auto_open_complaint(
    id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Called when admin first opens a 'new' complaint — auto-advances to in_progress."""
    complaint = await _get_complaint_or_404(id, current_user, db)
    if complaint.status != ComplaintStatus.new:
        return {"success": True, "data": {"status": complaint.status}, "message": "No change"}
    complaint.status = ComplaintStatus.in_progress
    audit = AuditLog(
        complaint_id=complaint.id,
        user_id=current_user.id,
        action="status_changed",
        details={"from": "new", "to": "in_progress", "auto": True},
    )
    db.add(audit)
    await db.commit()
    await db.refresh(complaint)
    return {"success": True, "data": {"status": complaint.status}, "message": "Complaint opened — status set to In Progress"}


@router.get("/complaints/urgent-count", response_model=dict)
async def urgent_count(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Count of open urgent complaints — used for sidebar badge."""
    base = _scoped_query(current_user)
    result = await db.execute(
        select(func.count()).select_from(
            base.where(
                Complaint.priority == ComplaintPriority.urgent,
                Complaint.status.notin_([ComplaintStatus.resolved, ComplaintStatus.closed]),
            ).subquery()
        )
    )
    count = result.scalar_one()
    return {"success": True, "data": {"count": count}}


class ReplyIn(BaseModel):
    content: str


@router.post("/complaints/{id}/reply", response_model=dict)
async def send_reply_to_user(
    id: int,
    body: ReplyIn,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin sends a formal reply to the complainer — visible on the track page."""
    complaint = await _get_complaint_or_404(id, current_user, db)
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="Reply content cannot be empty")

    reply = Reply(
        complaint_id=complaint.id,
        content=body.content.strip(),
        sent_at=datetime.utcnow(),
        sent_by_admin_id=current_user.id,
    )
    db.add(reply)

    audit = AuditLog(
        complaint_id=complaint.id,
        user_id=current_user.id,
        action="admin_replied",
        details={"by": current_user.full_name, "preview": body.content[:80]},
    )
    db.add(audit)
    await db.commit()
    await db.refresh(reply)

    if complaint.submitter_email:
        background_tasks.add_task(
            notification_service.notify_worker,
            "update",
            complaint.submitter_email,
            complaint.reference_id,
            complaint.tracking_token,
        )

    return {
        "success": True,
        "data": {"id": reply.id, "content": reply.content, "sent_at": reply.sent_at.isoformat()},
        "message": "Reply sent",
    }


@router.get("/complaints/export")
async def export_complaints(
    status: ComplaintStatus | None = Query(None),
    category: ComplaintCategory | None = Query(None),
    priority: ComplaintPriority | None = Query(None),
    plant: str | None = Query(None),
    search: str | None = Query(None),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Export complaints as CSV (opens directly in Excel)."""
    base = _scoped_query(current_user)

    if status:
        base = base.where(Complaint.status == status)
    if category:
        base = base.where(Complaint.category == category)
    if priority:
        base = base.where(Complaint.priority == priority)
    if plant and current_user.role == UserRole.superadmin:
        base = base.where(Complaint.plant == plant)
    if search:
        term = f"%{search}%"
        base = base.where(
            or_(
                Complaint.reference_id.ilike(term),
                Complaint.submitter_name.ilike(term),
                Complaint.submitter_employee_id.ilike(term),
                Complaint.description.ilike(term),
            )
        )

    result = await db.execute(base.order_by(Complaint.created_at.desc()))
    complaints = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Reference ID", "Category", "Status", "Priority", "Plant",
        "Submitter Name", "Employee ID", "Email", "Phone",
        "Description", "AI Classification", "AI Priority",
        "Assigned Vendor ID", "Created At", "Updated At", "Closed At",
    ])
    for c in complaints:
        writer.writerow([
            c.reference_id,
            c.category.value,
            c.status.value,
            c.priority.value,
            c.plant,
            c.submitter_name,
            c.submitter_employee_id,
            c.submitter_email or "",
            c.submitter_phone or "",
            c.description.replace("\n", " "),
            c.ai_classification or "",
            c.ai_priority or "",
            c.assigned_vendor_id or "",
            c.created_at.strftime("%Y-%m-%d %H:%M") if c.created_at else "",
            c.updated_at.strftime("%Y-%m-%d %H:%M") if c.updated_at else "",
            c.closed_at.strftime("%Y-%m-%d %H:%M") if c.closed_at else "",
        ])

    output.seek(0)
    filename = f"complaints_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/complaints/{id}", response_model=dict)
async def get_complaint(
    id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    complaint = await _get_complaint_or_404(id, current_user, db)
    return {
        "success": True,
        "data": ComplaintDetailOut.model_validate(complaint).model_dump(),
    }


@router.patch("/complaints/{id}/status", response_model=dict)
async def update_status(
    id: int,
    body: StatusIn,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    complaint = await _get_complaint_or_404(id, current_user, db)
    old_status = complaint.status
    complaint.status = body.status

    if body.status in (ComplaintStatus.resolved, ComplaintStatus.closed):
        complaint.closed_at = datetime.utcnow()

    audit = AuditLog(
        complaint_id=complaint.id,
        user_id=current_user.id,
        action="status_changed",
        details={"from": old_status.value, "to": body.status.value},
    )
    db.add(audit)
    await db.commit()
    await db.refresh(complaint)

    # Non-blocking worker notification
    new_status_val = body.status.value
    if complaint.submitter_email:
        if new_status_val == "in_progress":
            trigger = "in_progress"
        elif new_status_val in ("resolved", "closed"):
            trigger = "resolved"
        else:
            trigger = "status_update"
        background_tasks.add_task(
            notification_service.notify_worker,
            trigger,
            complaint.submitter_email,
            complaint.reference_id,
            complaint.tracking_token,
            new_status=new_status_val,
        )

    return {"success": True, "data": {"status": complaint.status}, "message": "Status updated"}


@router.patch("/complaints/{id}/priority", response_model=dict)
async def update_priority(
    id: int,
    body: PriorityIn,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    complaint = await _get_complaint_or_404(id, current_user, db)
    complaint.priority = body.priority

    audit = AuditLog(
        complaint_id=complaint.id,
        user_id=current_user.id,
        action="priority_changed",
        details={"to": body.priority.value},
    )
    db.add(audit)
    await db.commit()

    return {"success": True, "data": {"priority": complaint.priority}, "message": "Priority updated"}


@router.post("/complaints/{id}/note", response_model=dict)
async def add_note(
    id: int,
    body: NoteIn,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    complaint = await _get_complaint_or_404(id, current_user, db)

    audit = AuditLog(
        complaint_id=complaint.id,
        user_id=current_user.id,
        action="note_added",
        details={"note": body.content, "by": current_user.full_name},
    )
    db.add(audit)
    await db.commit()
    await db.refresh(audit)

    return {"success": True, "data": AuditLogOut.model_validate(audit).model_dump(), "message": "Note added"}


@router.patch("/complaints/{id}/assign-vendor", response_model=dict)
async def assign_vendor(
    id: int,
    body: AssignVendorIn,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    complaint = await _get_complaint_or_404(id, current_user, db)

    vendor = None
    # Validate vendor exists and has vendor role if provided
    if body.vendor_id is not None:
        result = await db.execute(
            select(User).where(User.id == body.vendor_id, User.role == "vendor", User.is_active == True)
        )
        vendor = result.scalar_one_or_none()
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")

    complaint.assigned_vendor_id = body.vendor_id
    if body.vendor_id and complaint.status == ComplaintStatus.new:
        complaint.status = ComplaintStatus.vendor_pending

    audit = AuditLog(
        complaint_id=complaint.id,
        user_id=current_user.id,
        action="vendor_assigned",
        details={"vendor_id": body.vendor_id},
    )
    db.add(audit)
    await db.commit()
    await db.refresh(complaint)

    # Notify vendor by email if they have one
    if vendor and vendor.email:
        from datetime import timedelta
        deadline = (datetime.utcnow() + timedelta(days=2)).strftime("%d %b %Y")
        case_url = f"{settings.FRONTEND_URL}/vendor"
        background_tasks.add_task(
            notification_service.notify_admin,
            "vendor_assigned",
            vendor.email,
            complaint.reference_id,
            category=complaint.category.value,
            priority=complaint.priority.value,
            deadline=deadline,
            case_url=case_url,
        )

    return {"success": True, "data": {"assigned_vendor_id": complaint.assigned_vendor_id}, "message": "Vendor assigned"}


class SubmitApprovalIn(BaseModel):
    notes: str | None = None


@router.post("/complaints/{id}/submit-approval", response_model=dict)
async def submit_for_approval(
    id: int,
    body: SubmitApprovalIn,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin submits a complaint for superadmin approval."""
    complaint = await _get_complaint_or_404(id, current_user, db)

    if complaint.status not in (ComplaintStatus.in_progress, ComplaintStatus.vendor_pending, ComplaintStatus.new):
        raise HTTPException(status_code=400, detail="Complaint cannot be submitted for approval in its current state")

    # Create or update approval record
    approval = complaint.approval
    if approval is None:
        approval = Approval(complaint_id=complaint.id)
        db.add(approval)
    approval.admin_id = current_user.id
    approval.admin_approved_at = datetime.utcnow()
    approval.admin_notes = body.notes
    approval.status = ApprovalStatus.pending_superadmin

    complaint.status = ComplaintStatus.awaiting_approval

    audit = AuditLog(
        complaint_id=complaint.id,
        user_id=current_user.id,
        action="submitted_for_approval",
        details={"notes": body.notes, "by": current_user.full_name},
    )
    db.add(audit)
    await db.commit()
    await db.refresh(complaint)

    return {
        "success": True,
        "data": {"status": complaint.status},
        "message": "Complaint submitted for superadmin approval",
    }


@router.get("/vendors", response_model=dict)
async def list_vendors(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.role == "vendor", User.is_active == True).order_by(User.full_name)
    )
    vendors = result.scalars().all()
    return {
        "success": True,
        "data": [{"id": v.id, "full_name": v.full_name, "email": v.email, "phone": v.phone, "plant": v.plant} for v in vendors],
    }


# ── User management ────────────────────────────────────────────────────────────

class CreateVendorIn(BaseModel):
    full_name: str
    phone: str
    password: str
    plant: str


class UserListItem(BaseModel):
    id: int
    full_name: str
    phone: str | None
    email: str | None
    plant: str | None
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/users", response_model=dict)
async def list_users(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.role == UserRole.vendor).order_by(User.created_at.desc())
    )
    users = result.scalars().all()
    return {
        "success": True,
        "data": [UserListItem.model_validate(u).model_dump() for u in users],
    }


@router.post("/users", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_vendor(
    body: CreateVendorIn,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    # Enforce minimum password strength
    try:
        validate_password(body.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Check phone not already taken
    existing = await db.execute(select(User).where(User.phone == body.phone))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Phone number already registered")

    vendor = User(
        full_name=body.full_name,
        phone=body.phone,
        email=None,
        password_hash=hash_password(body.password),
        role=UserRole.vendor,
        plant=body.plant,
        is_active=True,
    )
    db.add(vendor)
    await db.commit()
    await db.refresh(vendor)

    return {
        "success": True,
        "data": UserListItem.model_validate(vendor).model_dump(),
        "message": f"Vendor account created for {vendor.full_name}",
    }


@router.patch("/users/{id}/toggle-active", response_model=dict)
async def toggle_vendor_active(
    id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == id, User.role == UserRole.vendor))
    vendor = result.scalar_one_or_none()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    vendor.is_active = not vendor.is_active
    await db.commit()

    return {
        "success": True,
        "data": {"is_active": vendor.is_active},
        "message": f"Vendor {'activated' if vendor.is_active else 'deactivated'}",
    }


# ── AI Features ────────────────────────────────────────────────────────────────

def _check_groq():
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="AI unavailable — add GROQ_API_KEY to .env")

def _check_claude():
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="AI unavailable — add ANTHROPIC_API_KEY to .env")


class TranslateRequest(BaseModel):
    target: str  # "en" or "ms"


@router.post("/complaints/{id}/translate", response_model=dict)
async def translate_complaint(
    id: int,
    body: TranslateRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    _check_groq()
    complaint = await _get_complaint_or_404(id, current_user, db)
    if body.target not in ("en", "ms"):
        raise HTTPException(status_code=400, detail="target must be 'en' or 'ms'")

    result = await ai_service.translate_text(complaint.description, body.target)
    if result.get("detected_lang") == "unknown":
        raise HTTPException(status_code=502, detail="Translation failed — AI service error")
    return {"success": True, "data": result}


@router.get("/complaints/{id}/ai-explain", response_model=dict)
async def ai_explain_complaint(
    id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    _check_groq()
    complaint = await _get_complaint_or_404(id, current_user, db)
    result = await ai_service.explain_complaint(
        description=complaint.description,
        category=complaint.category.value,
        ai_classification=complaint.ai_classification or "",
        ai_sentiment=complaint.ai_sentiment,
    )
    if result.get("summary") == "Unable to generate explanation.":
        raise HTTPException(status_code=502, detail="AI analysis failed — check GROQ_API_KEY")
    return {"success": True, "data": result}


@router.post("/complaints/{id}/ai-draft", response_model=dict)
async def ai_draft_reply(
    id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    _check_groq()
    complaint = await _get_complaint_or_404(id, current_user, db)

    # Pull latest vendor response if any
    logs_q = await db.execute(
        select(AuditLog)
        .where(AuditLog.complaint_id == complaint.id, AuditLog.action == "vendor_response")
        .order_by(AuditLog.created_at.desc())
        .limit(1)
    )
    vendor_log = logs_q.scalar_one_or_none()
    vendor_action = ""
    if vendor_log and vendor_log.details:
        vendor_action = str(vendor_log.details.get("action_taken", ""))

    details = {
        "reference_id": complaint.reference_id,
        "category": complaint.category.value,
        "description": complaint.description,
        "status": complaint.status.value,
        "ai_classification": complaint.ai_classification or "",
        "vendor_action_taken": vendor_action,
    }
    draft = await ai_service.generate_reply_draft(details)
    if not draft:
        raise HTTPException(status_code=502, detail="Draft generation failed — check ANTHROPIC_API_KEY")
    return {"success": True, "data": {"draft": draft}}
