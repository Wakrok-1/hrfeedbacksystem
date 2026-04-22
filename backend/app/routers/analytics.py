"""
Analytics router — all /api/analytics/* endpoints.
Admin sees own plant only. Superadmin sees all.
"""

import time
import uuid
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.dependencies import require_admin
from app.models.complaint import Complaint, ComplaintCategory, ComplaintStatus
from app.models.tracking import AuditLog
from app.models.user import Department, User, UserRole
from app.models.vendor import VendorResponse

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

# ── In-memory stores ───────────────────────────────────────────────────────

_cache: dict[str, tuple] = {}          # key -> (value, timestamp)
_anomalies: list[dict] = []            # active anomalies
_dismissed_ids: set[str] = set()       # dismissed anomaly ids


async def _get_cached(key: str, generator_fn, ttl: int = 3600):
    now = time.time()
    if key in _cache:
        value, ts = _cache[key]
        if now - ts < ttl:
            return value
    result = await generator_fn()
    _cache[key] = (result, now)
    return result


# ── Helpers ─────────────────────────────────────────────────────────────────

def _resolve_range(
    range_: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    if range_ == "live":
        return now - timedelta(hours=24), now
    if range_ == "today":
        return now.replace(hour=0, minute=0, second=0, microsecond=0), now
    if range_ == "7d":
        return now - timedelta(days=7), now
    if range_ == "30d":
        return now - timedelta(days=30), now
    if range_ == "custom":
        if not start_date or not end_date:
            raise HTTPException(400, "start_date and end_date required for custom range")
        return (
            datetime.fromisoformat(start_date).replace(tzinfo=timezone.utc),
            datetime.fromisoformat(end_date).replace(tzinfo=timezone.utc),
        )
    return now - timedelta(days=7), now


def _pf(user: User) -> list:
    """Plant filter — superadmin sees all."""
    if user.role == UserRole.superadmin:
        return []
    return [Complaint.plant == user.plant]


def _tz(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _hour_to_shift(hour: int) -> str:
    if 6 <= hour < 11:
        return "Morning"
    if 11 <= hour < 14:
        return "Lunch"
    if 14 <= hour < 16:
        return "Tea Break"
    if 16 <= hour < 20:
        return "Dinner"
    if hour >= 20 or hour < 6:
        return "Night Shift"
    return "Other"


_SHIFTS = ["Morning", "Lunch", "Tea Break", "Dinner", "Night Shift", "Other"]
_DAYS   = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

_STOP = {
    "the","a","an","and","or","but","in","on","at","to","for","of","with",
    "is","was","are","were","be","been","have","has","had","do","does","did",
    "will","would","could","should","may","might","not","no","it","its","this",
    "that","these","those","i","my","we","our","you","your","he","she","they",
    "their","there","here","what","which","who","when","where","how","why",
    "all","any","some","very","so","too","also","saya","kami","mereka","ini",
    "itu","yang","dan","atau","di","ke","dari","ada","tidak","untuk","dengan",
    "pada","telah","sudah","akan","dapat","oleh","lebih","sangat","juga",
    "please","thank","dear","regarding","about","said","told","complaint",
}


def _extract_keywords(texts: list[str], top_n: int = 15) -> list[dict]:
    words: list[str] = []
    for t in texts:
        for w in t.lower().split():
            w = w.strip(".,!?;:\"'()")
            if len(w) > 3 and w not in _STOP and w.isalpha():
                words.append(w)
    return [{"word": w, "count": c} for w, c in Counter(words).most_common(top_n)]


def _sentiment_label(score: float) -> str:
    if score >= 0.2:
        return "positive"
    if score <= -0.2:
        return "negative"
    return "neutral"


# ── 1. Overview ─────────────────────────────────────────────────────────────

@router.get("/overview")
async def analytics_overview(
    range: str = Query("7d"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    start, end = _resolve_range(range, start_date, end_date)
    pf = _pf(current_user)

    rows = await db.execute(
        select(Complaint.status, func.count(Complaint.id))
        .where(Complaint.created_at >= start, Complaint.created_at <= end, *pf)
        .group_by(Complaint.status)
    )
    counts: dict[str, int] = {r[0]: r[1] for r in rows.fetchall()}

    urgent_q = await db.execute(
        select(func.count(Complaint.id))
        .where(Complaint.created_at >= start, Complaint.created_at <= end,
               Complaint.priority == "urgent", *pf)
    )
    urgent_count = urgent_q.scalar() or 0

    breach_cutoff = datetime.now(timezone.utc) - timedelta(hours=72)
    breach_q = await db.execute(
        select(func.count(Complaint.id))
        .where(
            Complaint.priority == "urgent",
            Complaint.created_at <= breach_cutoff,
            Complaint.status.not_in(["resolved", "closed"]),
            *pf,
        )
    )
    sla_breach_count = breach_q.scalar() or 0

    return {"success": True, "data": {
        "total":             sum(counts.values()),
        "open":              counts.get("new", 0) + counts.get("in_progress", 0),
        "new":               counts.get("new", 0),
        "in_progress":       counts.get("in_progress", 0),
        "vendor_pending":    counts.get("vendor_pending", 0),
        "awaiting_approval": counts.get("awaiting_approval", 0),
        "escalated":         counts.get("escalated", 0),
        "resolved":          counts.get("resolved", 0),
        "closed":            counts.get("closed", 0),
        "urgent_count":      urgent_count,
        "sla_breach_count":  sla_breach_count,
    }}


# ── 2. Metrics ──────────────────────────────────────────────────────────────

@router.get("/metrics")
async def analytics_metrics(
    range: str = Query("7d"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    start, end = _resolve_range(range, start_date, end_date)
    pf = _pf(current_user)

    # Total + resolved
    total_q   = await db.execute(select(func.count(Complaint.id)).where(Complaint.created_at >= start, Complaint.created_at <= end, *pf))
    total     = total_q.scalar() or 0
    res_q     = await db.execute(select(func.count(Complaint.id)).where(Complaint.created_at >= start, Complaint.created_at <= end, Complaint.status.in_(["resolved","closed"]), *pf))
    resolved  = res_q.scalar() or 0
    resolution_rate = round(resolved / total * 100, 1) if total else 0.0

    # Fetch complaint ids + created_at for time calculations
    c_rows = (await db.execute(
        select(Complaint.id, Complaint.created_at)
        .where(Complaint.created_at >= start, Complaint.created_at <= end, *pf)
    )).fetchall()
    cids     = [r[0] for r in c_rows]
    c_created = {r[0]: _tz(r[1]) for r in c_rows}

    avg_response_hours  = 0.0
    avg_resolution_days = 0.0

    if cids:
        # Avg response: created_at → first in_progress audit log
        ip_logs = (await db.execute(
            select(AuditLog.complaint_id, func.min(AuditLog.created_at))
            .where(
                AuditLog.complaint_id.in_(cids),
                AuditLog.action == "status_changed",
                AuditLog.details["to"].astext == "in_progress",
            )
            .group_by(AuditLog.complaint_id)
        )).fetchall()
        response_times = [
            (_tz(fr) - c_created[cid]).total_seconds() / 3600
            for cid, fr in ip_logs
            if cid in c_created and (_tz(fr) - c_created[cid]).total_seconds() >= 0
        ]
        if response_times:
            avg_response_hours = round(sum(response_times) / len(response_times), 1)

        # Avg resolution: created_at → first resolved/closed audit log
        res_logs = (await db.execute(
            select(AuditLog.complaint_id, func.min(AuditLog.created_at))
            .where(
                AuditLog.complaint_id.in_(cids),
                AuditLog.action == "status_changed",
                AuditLog.details["to"].astext.in_(["resolved","closed"]),
            )
            .group_by(AuditLog.complaint_id)
        )).fetchall()
        resolution_times = [
            (_tz(rat) - c_created[cid]).total_seconds() / 86400
            for cid, rat in res_logs
            if cid in c_created and (_tz(rat) - c_created[cid]).total_seconds() >= 0
        ]
        if resolution_times:
            avg_resolution_days = round(sum(resolution_times) / len(resolution_times), 1)

    # SLA compliance (urgent resolved within 72h)
    urg_total_q = await db.execute(select(func.count(Complaint.id)).where(Complaint.created_at >= start, Complaint.created_at <= end, Complaint.priority == "urgent", *pf))
    urg_total = urg_total_q.scalar() or 0

    sla_ok = 0
    if urg_total and cids:
        urg_cids_q = await db.execute(
            select(Complaint.id, Complaint.created_at)
            .where(Complaint.created_at >= start, Complaint.created_at <= end, Complaint.priority == "urgent", *pf)
        )
        urg_map = {r[0]: _tz(r[1]) for r in urg_cids_q.fetchall()}
        if urg_map:
            urg_res_logs = (await db.execute(
                select(AuditLog.complaint_id, func.min(AuditLog.created_at))
                .where(
                    AuditLog.complaint_id.in_(list(urg_map.keys())),
                    AuditLog.action == "status_changed",
                    AuditLog.details["to"].astext.in_(["resolved","closed"]),
                )
                .group_by(AuditLog.complaint_id)
            )).fetchall()
            for cid, rat in urg_res_logs:
                if cid in urg_map and (_tz(rat) - urg_map[cid]).total_seconds() <= 72 * 3600:
                    sla_ok += 1

    sla_compliance_rate = round(sla_ok / urg_total * 100, 1) if urg_total else 100.0

    # Vendor response rate: % vendor-pending cases responded within 48h
    vr_rows = (await db.execute(
        select(VendorResponse.complaint_id, VendorResponse.submitted_at, Complaint.created_at)
        .join(Complaint, Complaint.id == VendorResponse.complaint_id)
        .where(Complaint.created_at >= start, Complaint.created_at <= end, VendorResponse.submitted_at.is_not(None), *pf)
    )).fetchall()
    vr_within = sum(
        1 for _, sub, cre in vr_rows
        if sub and (_tz(sub) - _tz(cre)).total_seconds() <= 48 * 3600
    )
    vr_total_q = await db.execute(
        select(func.count(Complaint.id))
        .where(Complaint.created_at >= start, Complaint.created_at <= end, Complaint.status.in_(["vendor_pending","resolved","closed"]), *pf)
    )
    vr_total = vr_total_q.scalar() or 0
    vendor_response_rate = round(vr_within / vr_total * 100, 1) if vr_total else 0.0

    return {"success": True, "data": {
        "resolution_rate":          resolution_rate,
        "avg_response_time_hours":  avg_response_hours,
        "avg_resolution_time_days": avg_resolution_days,
        "sla_compliance_rate":      sla_compliance_rate,
        "vendor_response_rate":     vendor_response_rate,
    }}


# ── 3. Trends ───────────────────────────────────────────────────────────────

@router.get("/trends")
async def analytics_trends(
    range: str = Query("30d"),
    granularity: str = Query("day"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    start, end = _resolve_range(range, start_date, end_date)
    pf = _pf(current_user)

    rows = (await db.execute(
        select(Complaint.id, Complaint.created_at, Complaint.status)
        .where(Complaint.created_at >= start, Complaint.created_at <= end, *pf)
    )).fetchall()

    def _bucket(dt: datetime) -> str:
        dt = _tz(dt)
        if granularity == "week":
            monday = dt - timedelta(days=dt.weekday())
            return monday.strftime("%Y-%m-%d")
        if granularity == "month":
            return dt.strftime("%Y-%m")
        return dt.strftime("%Y-%m-%d")

    buckets: dict[str, dict] = {}
    for _, created, status in rows:
        key = _bucket(created)
        if key not in buckets:
            buckets[key] = {"date": key, "complaints_count": 0, "resolved_count": 0}
        buckets[key]["complaints_count"] += 1
        if status in ("resolved", "closed"):
            buckets[key]["resolved_count"] += 1

    data = sorted(buckets.values(), key=lambda x: x["date"])
    return {"success": True, "data": data}


# ── 4. By category ──────────────────────────────────────────────────────────

@router.get("/by-category")
async def analytics_by_category(
    range: str = Query("30d"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    start, end = _resolve_range(range, start_date, end_date)
    pf = _pf(current_user)

    rows = (await db.execute(
        select(Complaint.category, Complaint.status, Complaint.ai_sentiment, Complaint.created_at)
        .where(Complaint.created_at >= start, Complaint.created_at <= end, *pf)
    )).fetchall()

    cats: dict[str, dict] = {}
    for cat, status, sentiment, created in rows:
        cat_str = cat if isinstance(cat, str) else cat.value
        if cat_str not in cats:
            cats[cat_str] = {"category": cat_str, "total": 0, "resolved": 0, "sentiments": [], "resolution_days": []}
        cats[cat_str]["total"] += 1
        if status in ("resolved", "closed"):
            cats[cat_str]["resolved"] += 1
        if sentiment is not None:
            cats[cat_str]["sentiments"].append(sentiment)

    # Avg resolution days per category
    cids_q = await db.execute(
        select(Complaint.id, Complaint.category, Complaint.created_at)
        .where(Complaint.created_at >= start, Complaint.created_at <= end, *pf)
    )
    cid_cat = {r[0]: (r[1] if isinstance(r[1], str) else r[1].value, _tz(r[2])) for r in cids_q.fetchall()}

    if cid_cat:
        res_logs = (await db.execute(
            select(AuditLog.complaint_id, func.min(AuditLog.created_at))
            .where(
                AuditLog.complaint_id.in_(list(cid_cat.keys())),
                AuditLog.action == "status_changed",
                AuditLog.details["to"].astext.in_(["resolved","closed"]),
            )
            .group_by(AuditLog.complaint_id)
        )).fetchall()
        for cid, rat in res_logs:
            if cid in cid_cat:
                cat_str, created = cid_cat[cid]
                diff = (_tz(rat) - created).total_seconds() / 86400
                if diff >= 0 and cat_str in cats:
                    cats[cat_str]["resolution_days"].append(diff)

    result = []
    for cat_str, d in cats.items():
        total = d["total"]
        resolved = d["resolved"]
        res_rate = round(resolved / total * 100, 1) if total else 0.0
        avg_days = round(sum(d["resolution_days"]) / len(d["resolution_days"]), 1) if d["resolution_days"] else 0.0
        avg_sent = round(sum(d["sentiments"]) / len(d["sentiments"]), 2) if d["sentiments"] else 0.0
        result.append({
            "category": cat_str,
            "total": total,
            "resolved": resolved,
            "resolution_rate": res_rate,
            "avg_resolution_days": avg_days,
            "sentiment_avg": avg_sent,
        })

    result.sort(key=lambda x: x["total"], reverse=True)
    return {"success": True, "data": result}


# ── 5. By plant ─────────────────────────────────────────────────────────────

@router.get("/by-plant")
async def analytics_by_plant(
    range: str = Query("30d"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    start, end = _resolve_range(range, start_date, end_date)
    pf = _pf(current_user)

    rows = (await db.execute(
        select(Complaint.plant, Complaint.status)
        .where(Complaint.created_at >= start, Complaint.created_at <= end, *pf)
    )).fetchall()

    plants: dict[str, dict] = {}
    for plant, status in rows:
        if plant not in plants:
            plants[plant] = {"plant": plant, "total": 0, "resolved": 0, "in_progress": 0, "pending": 0}
        plants[plant]["total"] += 1
        if status in ("resolved", "closed"):
            plants[plant]["resolved"] += 1
        elif status == "in_progress":
            plants[plant]["in_progress"] += 1
        else:
            plants[plant]["pending"] += 1

    return {"success": True, "data": sorted(plants.values(), key=lambda x: x["plant"])}


# ── 6. Shift heatmap ────────────────────────────────────────────────────────

@router.get("/shift-heatmap")
async def analytics_shift_heatmap(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    pf = _pf(current_user)

    rows = (await db.execute(
        select(Complaint.created_at, Complaint.category)
        .where(*pf)
    )).fetchall()

    grid: dict[tuple, dict] = {}
    for created, cat in rows:
        dt    = _tz(created)
        day   = _DAYS[dt.weekday()]
        shift = _hour_to_shift(dt.hour)
        key   = (day, shift)
        cat_str = cat if isinstance(cat, str) else cat.value
        if key not in grid:
            grid[key] = {"day": day, "shift_period": shift, "count": 0, "cat_counts": Counter()}
        grid[key]["count"] += 1
        grid[key]["cat_counts"][cat_str] += 1

    data = []
    for (day, shift) in [(d, s) for d in _DAYS for s in _SHIFTS]:
        if (day, shift) in grid:
            g = grid[(day, shift)]
            top_cat = g["cat_counts"].most_common(1)[0][0] if g["cat_counts"] else ""
            data.append({"day": day, "shift_period": shift, "count": g["count"], "top_category": top_cat})
        else:
            data.append({"day": day, "shift_period": shift, "count": 0, "top_category": ""})

    return {"success": True, "data": data}


# ── 7. Vendor performance ────────────────────────────────────────────────────

@router.get("/vendor-performance")
async def analytics_vendor_performance(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models.user import UserRole as UR
    pf_vendor_complaint = _pf(current_user)

    vendors = (await db.execute(
        select(User).where(User.role == UR.vendor, User.is_active == True)
    )).scalars().all()

    data = []
    for v in vendors:
        # Cases assigned
        assigned_q = await db.execute(
            select(func.count(Complaint.id))
            .where(Complaint.assigned_vendor_id == v.id, *pf_vendor_complaint)
        )
        cases_assigned = assigned_q.scalar() or 0

        # Cases resolved
        resolved_q = await db.execute(
            select(func.count(Complaint.id))
            .where(Complaint.assigned_vendor_id == v.id, Complaint.status.in_(["resolved","closed"]), *pf_vendor_complaint)
        )
        cases_resolved = resolved_q.scalar() or 0

        # Avg response time (submission within 48h)
        vr_rows = (await db.execute(
            select(VendorResponse.submitted_at, Complaint.created_at)
            .join(Complaint, Complaint.id == VendorResponse.complaint_id)
            .where(VendorResponse.vendor_id == v.id, VendorResponse.submitted_at.is_not(None), *pf_vendor_complaint)
        )).fetchall()

        response_hours = [
            (_tz(sub) - _tz(cre)).total_seconds() / 3600
            for sub, cre in vr_rows
            if sub and (_tz(sub) - _tz(cre)).total_seconds() >= 0
        ]
        avg_response = round(sum(response_hours) / len(response_hours), 1) if response_hours else 0.0

        # SLA breaches: assigned + still open + >48h since created
        breach_cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
        breach_q = await db.execute(
            select(func.count(Complaint.id))
            .where(
                Complaint.assigned_vendor_id == v.id,
                Complaint.status.not_in(["resolved","closed"]),
                Complaint.created_at <= breach_cutoff,
                *pf_vendor_complaint,
            )
        )
        sla_breaches = breach_q.scalar() or 0

        reliability = round(cases_resolved / cases_assigned * 100, 1) if cases_assigned else 0.0
        color_band = "green" if reliability > 80 else ("amber" if reliability >= 50 else "red")

        data.append({
            "vendor_id":            v.id,
            "vendor_name":          v.full_name,
            "vendor_phone":         v.phone or "",
            "cases_assigned":       cases_assigned,
            "cases_resolved":       cases_resolved,
            "avg_response_time_hours": avg_response,
            "sla_breaches":         sla_breaches,
            "reliability_score":    reliability,
            "color_band":           color_band,
        })

    data.sort(key=lambda x: x["reliability_score"], reverse=True)
    return {"success": True, "data": data}


# ── 8. Sentiment ─────────────────────────────────────────────────────────────

@router.get("/sentiment")
async def analytics_sentiment(
    range: str = Query("30d"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    start, end = _resolve_range(range, start_date, end_date)
    prev_start = start - (end - start)
    pf = _pf(current_user)

    rows = (await db.execute(
        select(Complaint.ai_sentiment, Complaint.category, Complaint.plant, Complaint.description)
        .where(Complaint.created_at >= start, Complaint.created_at <= end, *pf)
    )).fetchall()

    all_scores = [r[0] for r in rows if r[0] is not None]
    overall_score = round(sum(all_scores) / len(all_scores), 2) if all_scores else 0.0

    # Trend vs previous period
    prev_rows = (await db.execute(
        select(Complaint.ai_sentiment)
        .where(Complaint.created_at >= prev_start, Complaint.created_at < start,
               Complaint.ai_sentiment.is_not(None), *pf)
    )).fetchall()
    prev_scores = [r[0] for r in prev_rows]
    prev_avg = sum(prev_scores) / len(prev_scores) if prev_scores else 0.0
    diff = overall_score - prev_avg
    trend = "improving" if diff > 0.05 else ("declining" if diff < -0.05 else "stable")

    # By category
    cat_data: dict[str, list] = {}
    plant_data: dict[str, list] = {}
    texts: list[str] = []
    for score, cat, plant, desc in rows:
        cat_str = cat if isinstance(cat, str) else cat.value
        if cat_str not in cat_data:
            cat_data[cat_str] = []
        if score is not None:
            cat_data[cat_str].append(score)
        if plant not in plant_data:
            plant_data[plant] = []
        if score is not None:
            plant_data[plant].append(score)
        if desc:
            texts.append(desc)

    by_category = [
        {"category": cat, "score": round(sum(scores)/len(scores),2) if scores else 0.0,
         "label": _sentiment_label(sum(scores)/len(scores) if scores else 0.0)}
        for cat, scores in cat_data.items()
    ]
    by_plant = [
        {"plant": plant, "score": round(sum(scores)/len(scores),2) if scores else 0.0,
         "label": _sentiment_label(sum(scores)/len(scores) if scores else 0.0)}
        for plant, scores in plant_data.items()
    ]

    # At-risk departments: backlog of open complaints older than 7 days
    old_cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    dept_rows = (await db.execute(
        select(Department.name, Department.plant, func.count(Complaint.id))
        .join(Complaint, Complaint.department_id == Department.id)
        .where(
            Complaint.status.not_in(["resolved","closed"]),
            Complaint.created_at <= old_cutoff,
        )
        .group_by(Department.id, Department.name, Department.plant)
        .having(func.count(Complaint.id) > 0)
    )).fetchall()

    at_risk = []
    for dept_name, plant, backlog_count in dept_rows:
        # SLA rate for this dept
        dept_total_q = await db.execute(
            select(func.count(Complaint.id))
            .join(Department, Department.id == Complaint.department_id)
            .where(Department.name == dept_name, Complaint.created_at >= start, Complaint.created_at <= end)
        )
        dept_total = dept_total_q.scalar() or 0
        dept_res_q = await db.execute(
            select(func.count(Complaint.id))
            .join(Department, Department.id == Complaint.department_id)
            .where(Department.name == dept_name, Complaint.created_at >= start,
                   Complaint.created_at <= end, Complaint.status.in_(["resolved","closed"]))
        )
        dept_res = dept_res_q.scalar() or 0
        sla_rate = round(dept_res / dept_total * 100, 1) if dept_total else 0.0

        at_risk.append({
            "department": dept_name,
            "plant": plant,
            "sla_rate": sla_rate,
            "backlog_age_days": 7,  # minimum — they're all >7d
            "backlog_count": backlog_count,
        })

    return {"success": True, "data": {
        "overall_score":        overall_score,
        "overall_label":        _sentiment_label(overall_score),
        "trend":                trend,
        "by_category":          by_category,
        "by_plant":             by_plant,
        "trending_keywords":    _extract_keywords(texts),
        "at_risk_departments":  at_risk,
    }}


# ── 9. Anomalies ─────────────────────────────────────────────────────────────

@router.get("/anomalies")
async def get_anomalies(current_user: User = Depends(require_admin)):
    active = [a for a in _anomalies if a["id"] not in _dismissed_ids]
    return {"success": True, "data": active}


@router.post("/anomalies/{anomaly_id}/dismiss")
async def dismiss_anomaly(anomaly_id: str, current_user: User = Depends(require_admin)):
    _dismissed_ids.add(anomaly_id)
    return {"success": True}


async def refresh_anomalies_job(db: AsyncSession):
    """Called by APScheduler every 30 minutes."""
    global _anomalies
    now = datetime.now(timezone.utc)
    current_start = now - timedelta(days=7)
    prev_start    = now - timedelta(days=14)

    # Volume by category — current vs previous
    cur_rows = (await db.execute(
        select(Complaint.category, func.count(Complaint.id))
        .where(Complaint.created_at >= current_start)
        .group_by(Complaint.category)
    )).fetchall()
    prev_rows = (await db.execute(
        select(Complaint.category, func.count(Complaint.id))
        .where(Complaint.created_at >= prev_start, Complaint.created_at < current_start)
        .group_by(Complaint.category)
    )).fetchall()

    cur_counts  = {(r[0] if isinstance(r[0], str) else r[0].value): r[1] for r in cur_rows}
    prev_counts = {(r[0] if isinstance(r[0], str) else r[0].value): r[1] for r in prev_rows}

    new_anomalies: list[dict] = []

    # Volume spike >30%
    for cat, cur in cur_counts.items():
        prev = prev_counts.get(cat, 0)
        if prev > 0 and cur > prev * 1.3:
            pct = round((cur - prev) / prev * 100)
            new_anomalies.append({
                "id": str(uuid.uuid4()),
                "type": "volume_spike",
                "category": cat,
                "message": f"{cat}: complaint volume up {pct}% vs previous week ({prev} → {cur})",
                "severity": "critical" if pct > 80 else "high",
                "detected_at": now.isoformat(),
            })
        elif prev == 0 and cur >= 5:
            new_anomalies.append({
                "id": str(uuid.uuid4()),
                "type": "volume_spike",
                "category": cat,
                "message": f"{cat}: {cur} new complaints this week (no previous baseline)",
                "severity": "medium",
                "detected_at": now.isoformat(),
            })

    # Vendor overdue: 2+ open cases past 48h
    breach_cutoff = now - timedelta(hours=48)
    vendor_breach = (await db.execute(
        select(User.full_name, func.count(Complaint.id))
        .join(Complaint, Complaint.assigned_vendor_id == User.id)
        .where(
            Complaint.status.not_in(["resolved","closed"]),
            Complaint.created_at <= breach_cutoff,
        )
        .group_by(User.id, User.full_name)
        .having(func.count(Complaint.id) >= 2)
    )).fetchall()

    for vendor_name, count in vendor_breach:
        new_anomalies.append({
            "id": str(uuid.uuid4()),
            "type": "vendor_overdue",
            "category": "Vendor",
            "message": f"{vendor_name} has {count} overdue cases past 48h SLA",
            "severity": "high",
            "detected_at": now.isoformat(),
        })

    # Backlog age >14 days
    old_cutoff = now - timedelta(days=14)
    old_q = await db.execute(
        select(func.count(Complaint.id))
        .where(
            Complaint.status.not_in(["resolved","closed"]),
            Complaint.created_at <= old_cutoff,
        )
    )
    old_count = old_q.scalar() or 0
    if old_count > 0:
        new_anomalies.append({
            "id": str(uuid.uuid4()),
            "type": "backlog_age",
            "category": "Backlog",
            "message": f"{old_count} complaint(s) open for more than 14 days — review required",
            "severity": "critical" if old_count > 5 else "medium",
            "detected_at": now.isoformat(),
        })

    # Keep dismissed logic — only replace non-dismissed
    _anomalies = new_anomalies


# ── 10. Root cause ────────────────────────────────────────────────────────────

@router.get("/root-cause")
async def analytics_root_cause(
    range: str = Query("30d"),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if not settings.GROQ_API_KEY:
        raise HTTPException(503, "AI unavailable — add GROQ_API_KEY to .env")

    start, end = _resolve_range(range)
    pf = _pf(current_user)

    rows = (await db.execute(
        select(Complaint.description, Complaint.category, Complaint.ai_classification, Complaint.ai_sentiment)
        .where(Complaint.created_at >= start, Complaint.created_at <= end, *pf)
        .limit(80)
    )).fetchall()

    cache_key = f"root_cause_{current_user.plant}_{range}"

    async def generate():
        from app.services.ai_service import get_groq
        descriptions = "\n".join(
            f"- [{r[1] if isinstance(r[1],str) else r[1].value}] {r[0][:120]}"
            for r in rows
        )
        prompt = f"""Analyze these {len(rows)} HR complaints and identify the top root causes.

Complaints:
{descriptions}

Return ONLY valid JSON array, no explanation:
[
  {{
    "title": "Root cause title",
    "confidence": 85,
    "complaint_count": 12,
    "severity": "high",
    "suggested_action": "What HR should do",
    "categories_involved": ["Canteen", "ESD"]
  }}
]

Rules:
- 3-6 root causes maximum
- severity: "low" | "medium" | "high" | "critical"
- confidence: 0-100
- suggested_action: concrete, specific action (1 sentence)"""

        resp = await get_groq().chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=800,
        )
        import json, re
        content = resp.choices[0].message.content.strip()
        match = re.search(r'\[.*\]', content, re.DOTALL)
        if not match:
            return []
        return json.loads(match.group())

    result = await _get_cached(cache_key, generate, ttl=3600)
    return {"success": True, "data": result}


# ── 11. AI Insights ──────────────────────────────────────────────────────────

@router.get("/ai-insights")
async def analytics_ai_insights(
    range: str = Query("30d"),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if not settings.GROQ_API_KEY:
        raise HTTPException(503, "AI unavailable — add GROQ_API_KEY to .env")

    start, end = _resolve_range(range)
    pf = _pf(current_user)

    # Build analytics summary for Groq
    cat_rows = (await db.execute(
        select(Complaint.category, Complaint.status, Complaint.ai_sentiment, Complaint.created_at)
        .where(Complaint.created_at >= start, Complaint.created_at <= end, *pf)
    )).fetchall()

    total = len(cat_rows)
    cat_stats: dict[str, dict] = {}
    for cat, status, sentiment, created in cat_rows:
        cat_str = cat if isinstance(cat, str) else cat.value
        if cat_str not in cat_stats:
            cat_stats[cat_str] = {"total": 0, "resolved": 0, "sentiments": []}
        cat_stats[cat_str]["total"] += 1
        if status in ("resolved","closed"):
            cat_stats[cat_str]["resolved"] += 1
        if sentiment is not None:
            cat_stats[cat_str]["sentiments"].append(sentiment)

    summary_lines = []
    for cat, s in cat_stats.items():
        t = s["total"]
        r = s["resolved"]
        avg_s = round(sum(s["sentiments"]) / len(s["sentiments"]), 2) if s["sentiments"] else 0
        res_rate = round(r / t * 100) if t else 0
        summary_lines.append(f"{cat}: {t} complaints, {res_rate}% resolved, sentiment {avg_s}")

    cache_key = f"ai_insights_{current_user.plant}_{range}"

    async def generate():
        from app.services.ai_service import get_groq
        prompt = f"""You are an HR analytics AI. Analyze this factory complaints data ({range} period, {total} total complaints):

{chr(10).join(summary_lines)}

Return ONLY valid JSON, no explanation:
{{
  "category_matrix": [
    {{
      "category": "Canteen",
      "avg_resolution_days": 2.3,
      "sla_breach_rate": 15.2,
      "sentiment_score": -0.3,
      "volume_trend": "up"
    }}
  ],
  "smart_insights": [
    {{"message": "insight text", "type": "pattern"}},
    {{"message": "insight text", "type": "warning"}},
    {{"message": "insight text", "type": "info"}}
  ],
  "predictive_forecast": {{
    "expected_min": 10,
    "expected_max": 18,
    "capacity_status": "manageable",
    "recommendation": "One sentence recommendation"
  }}
}}

Rules:
- volume_trend: "up" | "down" | "stable"
- smart_insights type: "pattern" | "warning" | "info"
- 3-5 smart_insights
- capacity_status: "low" | "manageable" | "high" | "critical"
- Base estimates on the data provided"""

        resp = await get_groq().chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=1000,
        )
        import json, re
        content = resp.choices[0].message.content.strip()
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if not match:
            return {"category_matrix": [], "smart_insights": [], "predictive_forecast": None}
        return json.loads(match.group())

    result = await _get_cached(cache_key, generate, ttl=3600)
    return {"success": True, "data": result}
