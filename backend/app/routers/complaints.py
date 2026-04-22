import asyncio
import uuid
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.complaint import Complaint, Attachment, ComplaintCategory, ComplaintStatus, ComplaintPriority
from app.models.user import Department, User, UserRole
from app.models.tracking import AuditLog
from app.schemas.complaint import ComplaintSubmit, ComplaintSubmitResponse
from app.services import ai_service, email_service, notification_service
from app.config import settings

router = APIRouter(prefix="/api", tags=["complaints"])

# Category prefix map
_CATEGORY_PREFIX = {
    ComplaintCategory.canteen: "CN",
    ComplaintCategory.locker: "LK",
    ComplaintCategory.esd: "ES",
    ComplaintCategory.transportation: "TR",
}


async def _generate_reference_id(db: AsyncSession, category: ComplaintCategory) -> str:
    """Generate sequential reference ID: CN-001, CN-002, etc."""
    prefix = _CATEGORY_PREFIX[category]
    result = await db.execute(
        select(func.count(Complaint.id)).where(Complaint.category == category)
    )
    count = result.scalar_one()
    return f"{prefix}-{str(count + 1).zfill(3)}"


async def _run_ai_classification(complaint_id: int, description: str, category: str, category_data: dict) -> None:
    """Background task: classify + prioritize + sentiment, then update complaint."""
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        try:
            issue_type = (category_data or {}).get("issue_type", "")

            classification, priority_result, sentiment = await asyncio.gather(
                ai_service.classify_complaint(description, category),
                ai_service.detect_priority(description, category, issue_type),
                ai_service.analyze_sentiment(description),
            )

            result = await db.execute(select(Complaint).where(Complaint.id == complaint_id))
            complaint = result.scalar_one_or_none()
            if complaint:
                complaint.ai_classification = classification.get("sub_category", "")
                complaint.ai_priority = priority_result
                complaint.ai_sentiment = sentiment.get("score", 0.0)

                # Upgrade priority to urgent if AI says so (never downgrade)
                if priority_result == "urgent":
                    complaint.priority = ComplaintPriority.urgent

                await db.commit()
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"AI background task failed for complaint {complaint_id}: {e}")


@router.post("/submit", status_code=status.HTTP_201_CREATED)
async def submit_complaint(
    body: ComplaintSubmit,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    # Generate IDs
    reference_id = await _generate_reference_id(db, body.category)
    tracking_token = str(uuid.uuid4())

    # Find department by category + plant (best-effort match)
    dept_result = await db.execute(
        select(Department).where(Department.plant == body.plant).limit(1)
    )
    department = dept_result.scalar_one_or_none()

    # Find an available admin in this plant (round-robin not needed at this stage — assign to first active admin)
    admin_result = await db.execute(
        select(User).where(
            User.role == UserRole.admin,
            User.plant == body.plant,
            User.is_active == True,
        ).limit(1)
    )
    assigned_admin = admin_result.scalar_one_or_none()

    # Create complaint
    complaint = Complaint(
        reference_id=reference_id,
        tracking_token=tracking_token,
        category=body.category,
        status=ComplaintStatus.new,
        priority=ComplaintPriority.normal,  # AI may upgrade in background
        plant=body.plant,
        submitter_name=body.submitter_name,
        submitter_employee_id=body.submitter_employee_id,
        submitter_email=body.submitter_email,
        submitter_phone=body.submitter_phone,
        description=body.description,
        category_data=body.category_data,
        department_id=department.id if department else None,
        assigned_admin_id=assigned_admin.id if assigned_admin else None,
    )
    db.add(complaint)
    await db.flush()  # get complaint.id before commit

    # Attachments
    for att in (body.attachment_urls or []):
        attachment = Attachment(
            complaint_id=complaint.id,
            file_name=att["file_name"],
            file_url=att["file_url"],
            file_type=att["file_type"],
            file_size_mb=att["file_size_mb"],
            uploaded_by_role="public",
        )
        db.add(attachment)

    # Audit log
    audit = AuditLog(
        complaint_id=complaint.id,
        user_id=None,
        action="complaint_submitted",
        details={
            "reference_id": reference_id,
            "category": body.category.value,
            "plant": body.plant,
        },
    )
    db.add(audit)

    await db.commit()
    await db.refresh(complaint)

    # Background: AI classification (non-blocking)
    background_tasks.add_task(
        _run_ai_classification,
        complaint.id,
        body.description,
        body.category.value,
        body.category_data or {},
    )

    # Background: emails
    if body.submitter_email:
        background_tasks.add_task(
            notification_service.notify_worker,
            "submitted",
            body.submitter_email,
            reference_id,
            tracking_token,
            category=body.category.value,
            plant=body.plant,
        )

    if assigned_admin:
        background_tasks.add_task(
            email_service.send_admin_new_complaint,
            assigned_admin.email,
            reference_id,
            body.category.value,
            complaint.priority.value,
            body.plant,
        )

    tracking_url = f"{settings.FRONTEND_URL}/track/{tracking_token}"

    return {
        "success": True,
        "data": ComplaintSubmitResponse(
            reference_id=reference_id,
            tracking_token=tracking_token,
            tracking_url=tracking_url,
        ),
        "message": "Complaint submitted successfully",
    }
