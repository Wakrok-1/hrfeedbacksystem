"""
Email Service — Resend API
All 7 email trigger types defined here.
"""
import logging
import resend
from app.config import settings

logger = logging.getLogger(__name__)

resend.api_key = settings.RESEND_API_KEY


def _send(to: list[str], subject: str, html: str) -> None:
    """Fire-and-forget wrapper. Logs on failure, never raises."""
    try:
        resend.Emails.send({
            "from": settings.FROM_EMAIL,
            "to": to,
            "subject": subject,
            "html": html,
        })
    except Exception as e:
        logger.error(f"Email send failed | to={to} subject={subject} | {e}")


# ---------------------------------------------------------------------------
# 1. Complaint submitted
# ---------------------------------------------------------------------------

def send_submission_confirmation(
    worker_email: str,
    reference_id: str,
    tracking_token: str,
) -> None:
    tracking_url = f"{settings.FRONTEND_URL}/track/{tracking_token}"
    _send(
        to=[worker_email],
        subject=f"Complaint Received — {reference_id}",
        html=f"""
        <h2>Your complaint has been received</h2>
        <p>Reference ID: <strong>{reference_id}</strong></p>
        <p>You can track the status of your complaint here:</p>
        <p><a href="{tracking_url}">{tracking_url}</a></p>
        <p>We will review your complaint and get back to you as soon as possible.</p>
        <br>
        <p>Thank you for bringing this to our attention.</p>
        <p>— Jabil HR Team</p>
        """,
    )


def send_admin_new_complaint(
    admin_email: str,
    reference_id: str,
    category: str,
    priority: str,
    plant: str,
) -> None:
    priority_label = "🔴 URGENT" if priority == "urgent" else "🟡 Normal"
    _send(
        to=[admin_email],
        subject=f"[{priority_label}] New Complaint Assigned — {reference_id}",
        html=f"""
        <h2>New complaint assigned to you</h2>
        <table>
          <tr><td><strong>Reference</strong></td><td>{reference_id}</td></tr>
          <tr><td><strong>Category</strong></td><td>{category}</td></tr>
          <tr><td><strong>Priority</strong></td><td>{priority_label}</td></tr>
          <tr><td><strong>Plant</strong></td><td>{plant}</td></tr>
        </table>
        <p>Please log in to the admin dashboard to review and take action.</p>
        <p><a href="{settings.FRONTEND_URL}/admin">Go to Dashboard</a></p>
        """,
    )


# ---------------------------------------------------------------------------
# 2. Forwarded to vendor
# ---------------------------------------------------------------------------

def send_vendor_case_assigned(
    vendor_email: str,
    reference_id: str,
    category: str,
    sla_deadline: str,
) -> None:
    _send(
        to=[vendor_email],
        subject=f"Case Assigned to You — {reference_id}",
        html=f"""
        <h2>A case has been assigned to your company</h2>
        <p>Reference ID: <strong>{reference_id}</strong></p>
        <p>Category: {category}</p>
        <p>Please respond by: <strong>{sla_deadline}</strong></p>
        <p>Log in to the vendor portal to review the case details and submit your response:</p>
        <p><a href="{settings.FRONTEND_URL}/vendor">Vendor Portal</a></p>
        """,
    )


# ---------------------------------------------------------------------------
# 3. SLA reminder (day 2-3)
# ---------------------------------------------------------------------------

def send_sla_reminder(
    admin_email: str,
    vendor_email: str,
    reference_id: str,
    days_elapsed: int,
) -> None:
    subject = f"Reminder: Case {reference_id} Awaiting Vendor Response ({days_elapsed} days)"
    html = f"""
    <h2>SLA Reminder</h2>
    <p>Case <strong>{reference_id}</strong> has been awaiting vendor response for <strong>{days_elapsed} days</strong>.</p>
    <p>Please follow up and ensure a response is submitted promptly.</p>
    <p><a href="{settings.FRONTEND_URL}/admin">View Case</a></p>
    """
    _send(to=[admin_email, vendor_email], subject=subject, html=html)


# ---------------------------------------------------------------------------
# 4. SLA escalation (day 7)
# ---------------------------------------------------------------------------

def send_sla_escalation(admin_email: str, reference_id: str) -> None:
    _send(
        to=[admin_email],
        subject=f"⚠️ ESCALATION: {reference_id} — Vendor Non-Response (7 Days)",
        html=f"""
        <h2 style="color:red">Escalation Alert</h2>
        <p>Vendor has not responded to case <strong>{reference_id}</strong> for <strong>7 days</strong>.</p>
        <p>Immediate action is required. Please reassign or escalate this case.</p>
        <p><a href="{settings.FRONTEND_URL}/admin">Go to Dashboard</a></p>
        """,
    )


# ---------------------------------------------------------------------------
# 5. SuperAdmin approved
# ---------------------------------------------------------------------------

def send_superadmin_approved(admin_email: str, reference_id: str) -> None:
    _send(
        to=[admin_email],
        subject=f"Case Approved — {reference_id}",
        html=f"""
        <h2>Case Approved by Super Admin</h2>
        <p>Case <strong>{reference_id}</strong> has been approved.</p>
        <p>Please send the resolution reply to the worker.</p>
        <p><a href="{settings.FRONTEND_URL}/admin">Go to Dashboard</a></p>
        """,
    )


# ---------------------------------------------------------------------------
# 6. Reply sent to worker
# ---------------------------------------------------------------------------

def send_reply_to_worker(
    worker_email: str,
    reference_id: str,
    category: str,
    reply_content: str,
) -> None:
    _send(
        to=[worker_email],
        subject=f"Resolution Update — {reference_id}",
        html=f"""
        <h2>Update on Your Complaint</h2>
        <p>Reference ID: <strong>{reference_id}</strong> | Category: {category}</p>
        <hr>
        <div style="background:#f5f5f5;padding:16px;border-radius:8px;">
          {reply_content.replace(chr(10), '<br>')}
        </div>
        <hr>
        <p>You can view the full status of your complaint here:</p>
        <p><a href="{settings.FRONTEND_URL}/track">Track My Complaint</a></p>
        <p>— Jabil HR Team</p>
        """,
    )


# ---------------------------------------------------------------------------
# 7. Weekly report
# ---------------------------------------------------------------------------

def send_weekly_report(
    recipients: list[str],
    period: str,
    report_summary: str,
    report_id: int,
) -> None:
    _send(
        to=recipients,
        subject=f"Weekly HR Complaints Report — {period}",
        html=f"""
        <h2>Weekly HR Complaints Summary</h2>
        <p>Period: <strong>{period}</strong></p>
        <hr>
        <p>{report_summary.replace(chr(10), '<br>')}</p>
        <hr>
        <p><a href="{settings.FRONTEND_URL}/admin/reports/{report_id}">View Full Report</a></p>
        <p>— Jabil HR System</p>
        """,
    )
