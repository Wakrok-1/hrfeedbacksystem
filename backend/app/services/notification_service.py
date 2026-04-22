"""
Notification Service — email notifications via Resend.

Worker triggers:   submitted | in_progress | update | resolved
Admin/Vendor triggers: vendor_assigned | vendor_reminder | vendor_escalation

All calls must be dispatched via FastAPI BackgroundTasks — never awaited directly.
This module never raises — all exceptions are caught and logged.

Phone numbers are stored on complaints but not used here.
# TODO: WhatsApp via Twilio/Meta API when budget available
"""
import logging
import resend
from app.config import settings

logger = logging.getLogger(__name__)

resend.api_key = settings.RESEND_API_KEY

_BRAND_COLOR = "#0F172A"
_CTA_COLOR = "#0369A1"
_URGENT_COLOR = "#DC2626"

_BASE_HTML = """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: Inter, Arial, sans-serif; background:#f8fafc; margin:0; padding:24px; color:#1e293b; }}
    .card {{ background:#fff; border-radius:12px; padding:32px; max-width:560px; margin:0 auto; border:1px solid #e2e8f0; }}
    .header {{ background:{brand}; border-radius:8px 8px 0 0; padding:20px 32px; margin:-32px -32px 24px; }}
    .header-logo {{ color:#fff; font-size:12px; font-weight:600; letter-spacing:0.08em; opacity:0.6; text-transform:uppercase; }}
    .header-title {{ color:#fff; font-size:20px; font-weight:700; margin-top:6px; }}
    .ref {{ display:inline-block; background:#f1f5f9; border-radius:6px; padding:4px 12px; font-family:monospace; font-size:14px; font-weight:600; color:#334155; margin-bottom:16px; border:1px solid #e2e8f0; }}
    .meta-row {{ display:flex; gap:24px; flex-wrap:wrap; margin-bottom:16px; }}
    .meta-item {{ flex:1; min-width:120px; }}
    .meta-label {{ font-size:11px; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:2px; }}
    .meta-value {{ font-size:14px; font-weight:600; color:#1e293b; }}
    .highlight-box {{ background:#f0f9ff; border-left:4px solid {cta}; border-radius:0 8px 8px 0; padding:14px 16px; margin:16px 0; font-size:13px; line-height:1.6; color:#0f172a; }}
    .urgent-box {{ background:#fef2f2; border-left:4px solid {urgent}; border-radius:0 8px 8px 0; padding:14px 16px; margin:16px 0; font-size:13px; line-height:1.6; color:#0f172a; }}
    .cta {{ display:inline-block; background:{cta}; color:#fff !important; text-decoration:none; padding:12px 28px; border-radius:8px; font-weight:600; font-size:14px; margin-top:16px; }}
    .cta-urgent {{ display:inline-block; background:{urgent}; color:#fff !important; text-decoration:none; padding:12px 28px; border-radius:8px; font-weight:600; font-size:14px; margin-top:16px; }}
    .footer {{ font-size:11px; color:#94a3b8; text-align:center; margin-top:28px; padding-top:16px; border-top:1px solid #f1f5f9; }}
    p {{ margin:0 0 12px; line-height:1.6; font-size:14px; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="header-logo">Jabil HR Feedback System</div>
      <div class="header-title">{{title}}</div>
    </div>
    {{body}}
    <div class="footer">Jabil HR Integrated Feedback System &middot; This is an automated notification &middot; Do not reply to this email</div>
  </div>
</body>
</html>""".replace("{brand}", _BRAND_COLOR).replace("{cta}", _CTA_COLOR).replace("{urgent}", _URGENT_COLOR)


def _render(title: str, body: str) -> str:
    return _BASE_HTML.replace("{{title}}", title).replace("{{body}}", body)


def _send(to: str, subject: str, html: str) -> None:
    """Fire-and-forget. Logs on failure, never raises."""
    if not to or not settings.RESEND_API_KEY:
        return
    try:
        resend.Emails.send({
            "from": settings.FROM_EMAIL,
            "to": [to],
            "subject": subject,
            "html": html,
        })
        logger.info(f"Email sent | to={to} | subject={subject}")
    except Exception as e:
        logger.error(f"Email failed | to={to} | subject={subject} | {e}")


# ── Worker templates ──────────────────────────────────────────────────────────

def _worker_submitted(email: str, reference_id: str, tracking_token: str, category: str, plant: str, submitted_at: str = "") -> None:
    tracking_url = f"{settings.FRONTEND_URL}/track/{tracking_token}"
    submitted_block = (
        f"<div class='meta-item'><div class='meta-label'>Submitted</div><div class='meta-value'>{submitted_at}</div></div>"
        if submitted_at else ""
    )
    html = _render(
        title="Complaint Received",
        body=f"""
        <span class="ref">{reference_id}</span>
        <p>Thank you — your complaint has been <strong>received and logged</strong> by the HR team.</p>
        <div class="meta-row">
          <div class="meta-item"><div class="meta-label">Category</div><div class="meta-value">{category}</div></div>
          <div class="meta-item"><div class="meta-label">Plant</div><div class="meta-value">{plant}</div></div>
          {submitted_block}
        </div>
        <p>Our HR team will review your complaint and keep you updated at every step.</p>
        <p>Track the live status of your complaint anytime using the link below:</p>
        <a class="cta" href="{tracking_url}">Track My Complaint</a>
        <p style="margin-top:16px;font-size:12px;color:#64748b;">
          Save this link — it is the only way to track your complaint.<br>
          Simpan pautan ini — ini adalah satu-satunya cara untuk memantau aduan anda.
        </p>
        """,
    )
    _send(email, f"Complaint Received — {reference_id}", html)


def _worker_in_progress(email: str, reference_id: str, tracking_token: str) -> None:
    tracking_url = f"{settings.FRONTEND_URL}/track/{tracking_token}"
    html = _render(
        title="Your Complaint Is Now In Review",
        body=f"""
        <span class="ref">{reference_id}</span>
        <p>Good news — our HR team has <strong>started reviewing</strong> your complaint.</p>
        <p>We will contact you once we have an update or if we need additional information.</p>
        <a class="cta" href="{tracking_url}">View Status</a>
        """,
    )
    _send(email, f"Complaint In Review — {reference_id}", html)


def _worker_update(email: str, reference_id: str, tracking_token: str) -> None:
    tracking_url = f"{settings.FRONTEND_URL}/track/{tracking_token}"
    html = _render(
        title="New Update on Your Complaint",
        body=f"""
        <span class="ref">{reference_id}</span>
        <p>The HR team has posted a <strong>new update</strong> on your complaint.</p>
        <p>Visit your tracking page to read the latest response:</p>
        <a class="cta" href="{tracking_url}">View Update</a>
        """,
    )
    _send(email, f"New Update — {reference_id}", html)


def _worker_resolved(email: str, reference_id: str, tracking_token: str, new_status: str, resolution_text: str = "") -> None:
    tracking_url = f"{settings.FRONTEND_URL}/track/{tracking_token}"
    is_closed = new_status == "closed"
    title = "Your Complaint Has Been Closed" if is_closed else "Your Complaint Has Been Resolved"
    message = (
        "Your complaint has been <strong>closed</strong>. No further action will be taken."
        if is_closed
        else "Your complaint has been <strong>resolved</strong>. We hope the issue has been addressed to your satisfaction."
    )
    resolution_block = f'<div class="highlight-box">{resolution_text}</div>' if resolution_text else ""
    html = _render(
        title=title,
        body=f"""
        <span class="ref">{reference_id}</span>
        <p>{message}</p>
        {resolution_block}
        <p>Thank you for bringing this matter to our attention. Your feedback helps us improve the workplace for everyone.</p>
        <a class="cta" href="{tracking_url}">View Resolution Details</a>
        <p style="margin-top:16px;font-size:12px;color:#64748b;">— Jabil HR Team</p>
        """,
    )
    _send(email, f"Complaint {'Closed' if is_closed else 'Resolved'} — {reference_id}", html)


# ── Vendor / Admin templates ──────────────────────────────────────────────────

def _vendor_assigned(email: str, reference_id: str, category: str, priority: str, deadline: str, case_url: str) -> None:
    priority_label = "URGENT" if priority == "urgent" else "Normal"
    priority_style = f"color:{_URGENT_COLOR};font-weight:700;" if priority == "urgent" else "color:#0369a1;font-weight:600;"
    html = _render(
        title="New Case Assigned to You",
        body=f"""
        <span class="ref">{reference_id}</span>
        <p>A complaint case has been <strong>assigned to your company</strong> and requires your response.</p>
        <div class="meta-row">
          <div class="meta-item"><div class="meta-label">Category</div><div class="meta-value">{category}</div></div>
          <div class="meta-item"><div class="meta-label">Priority</div><div class="meta-value" style="{priority_style}">{priority_label}</div></div>
          <div class="meta-item"><div class="meta-label">Response Deadline</div><div class="meta-value">{deadline}</div></div>
        </div>
        <p>Please review the case details and submit your response before the deadline.</p>
        <a class="cta" href="{case_url}">View Case &amp; Respond</a>
        """,
    )
    _send(email, f"Case Assigned — {reference_id} [{priority_label}]", html)


def _vendor_reminder(email: str, reference_id: str, days_elapsed: int, deadline: str, case_url: str) -> None:
    days_word = f"{days_elapsed} day{'s' if days_elapsed != 1 else ''}"
    html = _render(
        title="Reminder: Case Awaiting Your Response",
        body=f"""
        <span class="ref">{reference_id}</span>
        <p>This case has been awaiting your response for <strong>{days_word}</strong>.</p>
        <div class="highlight-box">
          <strong>Response deadline:</strong> {deadline}
        </div>
        <p>Please submit your response as soon as possible to avoid escalation.</p>
        <a class="cta" href="{case_url}">Submit Response</a>
        """,
    )
    _send(email, f"Reminder: Case {reference_id} Awaiting Response ({days_elapsed}d)", html)


def _vendor_escalation(email: str, reference_id: str, vendor_name: str, days_elapsed: int, case_url: str) -> None:
    days_word = f"{days_elapsed} day{'s' if days_elapsed != 1 else ''}"
    html = _render(
        title="ESCALATION: Case Requires Immediate Action",
        body=f"""
        <span class="ref">{reference_id}</span>
        <div class="urgent-box">
          <strong>Escalation Alert</strong><br>
          Vendor <strong>{vendor_name}</strong> has not responded to this case for <strong>{days_word}</strong>.
          Immediate action is required.
        </div>
        <p>Please reassign this case or contact the vendor directly to resolve the delay.</p>
        <a class="cta-urgent" href="{case_url}">Review Escalated Case</a>
        """,
    )
    _send(email, f"ESCALATION: {reference_id} — No Vendor Response ({days_elapsed}d)", html)


# ── Public dispatchers ────────────────────────────────────────────────────────

def notify_worker(
    trigger: str,
    worker_email: str | None,
    reference_id: str,
    tracking_token: str,
    *,
    category: str = "",
    plant: str = "",
    submitted_at: str = "",
    new_status: str = "",
    resolution_text: str = "",
) -> None:
    """
    Single entry point for all worker-facing notifications.
    Always called via BackgroundTasks — never awaited directly.

    trigger values:
      "submitted"   → complaint received confirmation
      "in_progress" → HR started reviewing
      "update"      → admin posted a reply / comment
      "resolved"    → complaint resolved or closed
    """
    if not worker_email:
        return
    try:
        if trigger == "submitted":
            _worker_submitted(worker_email, reference_id, tracking_token, category, plant, submitted_at)
        elif trigger == "in_progress":
            _worker_in_progress(worker_email, reference_id, tracking_token)
        elif trigger == "update":
            _worker_update(worker_email, reference_id, tracking_token)
        elif trigger == "resolved":
            _worker_resolved(worker_email, reference_id, tracking_token, new_status, resolution_text)
    except Exception as e:
        logger.error(f"notify_worker failed | trigger={trigger} | ref={reference_id} | {e}")


def notify_admin(
    trigger: str,
    admin_email: str | None,
    reference_id: str,
    *,
    category: str = "",
    priority: str = "normal",
    deadline: str = "",
    case_url: str = "",
    days_elapsed: int = 0,
    vendor_name: str = "",
) -> None:
    """
    Single entry point for vendor / admin-facing notifications.
    Always called via BackgroundTasks — never awaited directly.

    trigger values:
      "vendor_assigned"   → new case assigned, sent to vendor email
      "vendor_reminder"   → SLA reminder, sent to vendor email
      "vendor_escalation" → non-response escalation, sent to admin email
    """
    if not admin_email:
        return
    try:
        if not case_url:
            case_url = f"{settings.FRONTEND_URL}/vendor"
        if trigger == "vendor_assigned":
            _vendor_assigned(admin_email, reference_id, category, priority, deadline, case_url)
        elif trigger == "vendor_reminder":
            _vendor_reminder(admin_email, reference_id, days_elapsed, deadline, case_url)
        elif trigger == "vendor_escalation":
            _vendor_escalation(admin_email, reference_id, vendor_name, days_elapsed, case_url)
    except Exception as e:
        logger.error(f"notify_admin failed | trigger={trigger} | ref={reference_id} | {e}")
