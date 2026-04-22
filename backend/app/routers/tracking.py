from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.complaint import Complaint, ComplaintStatus

router = APIRouter(prefix="/api", tags=["tracking"])

# Status steps for the visual step indicator (in order)
STATUS_STEPS = [
    ComplaintStatus.new,
    ComplaintStatus.in_progress,
    ComplaintStatus.vendor_pending,
    ComplaintStatus.awaiting_approval,
    ComplaintStatus.resolved,
    ComplaintStatus.closed,
]

STATUS_LABELS = {
    ComplaintStatus.new: "Submitted",
    ComplaintStatus.in_progress: "In Review",
    ComplaintStatus.vendor_pending: "In Progress",
    ComplaintStatus.awaiting_approval: "Awaiting Approval",
    ComplaintStatus.resolved: "Resolved",
    ComplaintStatus.closed: "Closed",
}


@router.get("/track/{tracking_token}")
async def track_complaint(
    tracking_token: str,
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import or_
    result = await db.execute(
        select(Complaint)
        .options(
            selectinload(Complaint.attachments),
            selectinload(Complaint.replies),
            selectinload(Complaint.audit_logs),
        )
        .where(
            or_(
                Complaint.tracking_token == tracking_token,
                Complaint.reference_id == tracking_token.upper(),
            )
        )
    )
    complaint = result.scalar_one_or_none()

    if not complaint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Complaint not found")

    # Build status timeline from audit logs
    timeline = [
        {
            "action": log.action,
            "details": log.details,
            "timestamp": log.created_at.isoformat(),
        }
        for log in sorted(complaint.audit_logs, key=lambda l: l.created_at)
    ]

    # Current step index for progress indicator
    try:
        step_index = STATUS_STEPS.index(complaint.status)
    except ValueError:
        step_index = 0

    steps = [
        {
            "key": s.value,
            "label": STATUS_LABELS[s],
            "completed": STATUS_STEPS.index(s) <= step_index,
            "active": s == complaint.status,
        }
        for s in STATUS_STEPS
    ]

    # Most recent sent reply (if any)
    sent_replies = [r for r in complaint.replies if r.sent_at is not None]
    latest_reply = max(sent_replies, key=lambda r: r.sent_at, default=None)

    reply_data = None
    if latest_reply:
        reply_data = {
            "id": latest_reply.id,
            "content": latest_reply.content,
            "sent_at": latest_reply.sent_at.isoformat(),
        }

    return {
        "success": True,
        "data": {
            "reference_id": complaint.reference_id,
            "category": complaint.category.value,
            "status": complaint.status.value,
            "priority": complaint.priority.value,
            "plant": complaint.plant,
            "submitted_at": complaint.created_at.isoformat(),
            "steps": steps,
            "reply": reply_data,
            "timeline": timeline,
            "attachments": [
                {"file_name": a.file_name, "file_url": a.file_url, "file_type": a.file_type}
                for a in complaint.attachments
            ],
        },
        "message": "",
    }
