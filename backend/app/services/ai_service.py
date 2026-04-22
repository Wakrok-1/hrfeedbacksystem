"""
AI Service
- Groq (fast): classification, priority detection, sentiment analysis
- Claude (quality): reply drafting, weekly reports, root cause, forecast
All functions are async and designed to be called from background tasks.
"""
import json
import logging
from groq import AsyncGroq
import anthropic
from app.config import settings

logger = logging.getLogger(__name__)

_groq_client: AsyncGroq | None = None
_claude_client: anthropic.AsyncAnthropic | None = None


def get_groq() -> AsyncGroq:
    global _groq_client
    if _groq_client is None:
        _groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    return _groq_client


def get_claude() -> anthropic.AsyncAnthropic:
    global _claude_client
    if _claude_client is None:
        _claude_client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _claude_client


# ---------------------------------------------------------------------------
# Groq — fast classification calls
# ---------------------------------------------------------------------------

async def classify_complaint(description: str, category: str) -> dict:
    """Returns { department: str, sub_category: str }"""
    prompt = f"""You are an HR complaint classifier for Jabil manufacturing.
Category: {category}
Description: {description}

Classify this complaint and return JSON with:
- "department": the most relevant department (Canteen Services / Locker Management / ESD Safety / Transportation / General HR)
- "sub_category": a brief sub-category label (max 5 words)

Respond ONLY with valid JSON, no explanation."""

    try:
        resp = await get_groq().chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=100,
            response_format={"type": "json_object"},
        )
        return json.loads(resp.choices[0].message.content)
    except Exception as e:
        logger.error(f"classify_complaint error: {e}")
        return {"department": category, "sub_category": "General"}


async def detect_priority(description: str, category: str, issue_type: str = "") -> str:
    """Returns 'urgent' or 'normal'"""
    prompt = f"""You are an HR priority detector for Jabil manufacturing.
Category: {category}
Issue type: {issue_type}
Description: {description}

Determine if this complaint is URGENT or NORMAL.
Urgent indicators: safety hazard, injury risk, food poisoning, dangerous driving, fire/electrical risk, harassment.
Normal: general dissatisfaction, slow service, aesthetic issues.

Respond ONLY with a JSON object: {{"priority": "urgent"}} or {{"priority": "normal"}}"""

    try:
        resp = await get_groq().chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=20,
            response_format={"type": "json_object"},
        )
        data = json.loads(resp.choices[0].message.content)
        return data.get("priority", "normal")
    except Exception as e:
        logger.error(f"detect_priority error: {e}")
        return "normal"


async def analyze_sentiment(description: str) -> dict:
    """Returns { score: float (-1 to 1), label: str }"""
    prompt = f"""Analyze the sentiment of this workplace complaint:
"{description}"

Return JSON: {{"score": <float from -1.0 to 1.0>, "label": "positive|neutral|negative"}}
-1.0 = very negative, 0 = neutral, 1.0 = very positive.
Respond ONLY with valid JSON."""

    try:
        resp = await get_groq().chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=50,
            response_format={"type": "json_object"},
        )
        return json.loads(resp.choices[0].message.content)
    except Exception as e:
        logger.error(f"analyze_sentiment error: {e}")
        return {"score": 0.0, "label": "neutral"}


# ---------------------------------------------------------------------------
# Claude — quality generation calls
# ---------------------------------------------------------------------------

async def translate_text(text: str, target_lang: str) -> dict:
    """Translate complaint text. target_lang: 'en' or 'ms'. Returns {translated, detected_lang}"""
    lang_names = {"en": "English", "ms": "Bahasa Malaysia"}
    target_name = lang_names.get(target_lang, "English")
    prompt = f"""Detect the language of this text and translate it to {target_name}.
Text: {text}

Return JSON: {{"detected_lang": "en"|"ms"|"other", "translated": "<translated text>"}}
- If the text is already in {target_name}, return it as-is in "translated"
- Preserve the meaning and tone exactly
Respond ONLY with valid JSON."""

    try:
        resp = await get_groq().chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=600,
            response_format={"type": "json_object"},
        )
        return json.loads(resp.choices[0].message.content)
    except Exception as e:
        logger.error(f"translate_text error: {e}")
        return {"detected_lang": "unknown", "translated": text}


async def explain_complaint(description: str, category: str, ai_classification: str, ai_sentiment: float | None) -> dict:
    """Returns an admin-facing AI explanation: summary, key_issue, severity_reason, suggested_action."""
    sentiment_label = (
        "very distressed" if (ai_sentiment or 0) < -0.5
        else "frustrated" if (ai_sentiment or 0) < -0.2
        else "mildly unhappy" if (ai_sentiment or 0) < 0
        else "neutral"
    )
    prompt = f"""You are an HR analyst at Jabil manufacturing. Summarize this worker complaint for the admin reviewing it.

Category: {category}
Sub-category: {ai_classification or "Unknown"}
Worker sentiment: {sentiment_label}
Complaint: {description}

Return JSON with these keys:
{{
  "summary": "2-3 sentence plain English summary of the core issue",
  "key_issue": "one short phrase (max 6 words) naming the root problem",
  "severity_reason": "1 sentence explaining why this is urgent or normal",
  "suggested_action": "1-2 sentences on what admin should do first"
}}
Respond ONLY with valid JSON."""

    try:
        resp = await get_groq().chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=300,
            response_format={"type": "json_object"},
        )
        return json.loads(resp.choices[0].message.content)
    except Exception as e:
        logger.error(f"explain_complaint error: {e}")
        return {
            "summary": "Unable to generate explanation.",
            "key_issue": ai_classification or category,
            "severity_reason": "",
            "suggested_action": "",
        }


async def generate_reply_draft(complaint_details: dict, superadmin_decision: str = "") -> str:
    """Returns a professional reply text to send to the worker."""
    vendor_note = ""
    if complaint_details.get("vendor_action_taken"):
        vendor_note = f"\n- Vendor action taken: {complaint_details.get('vendor_action_taken')}"

    prompt = f"""You are an HR officer at Jabil manufacturing writing a formal reply to a worker's complaint.

Complaint details:
- Reference: {complaint_details.get('reference_id')}
- Category: {complaint_details.get('category')}
- Issue type: {complaint_details.get('ai_classification', '')}
- Description: {complaint_details.get('description')}
- Current status: {complaint_details.get('status')}{vendor_note}
- Superadmin decision: {superadmin_decision or 'Approved for resolution'}

Write a professional, empathetic HR reply letter in English that:
1. Opens by acknowledging the specific complaint (reference the issue type, not just "your complaint")
2. Explains the action taken or next steps clearly
3. Gives a realistic timeline if applicable
4. Closes by thanking the worker for raising it

Rules:
- 150–220 words
- No placeholders like [NAME] — write it as-is
- Formal but human tone
- Do NOT include a subject line or email header
- Output only the letter body, nothing else"""

    try:
        resp = await get_groq().chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=400,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"generate_reply_draft error: {e}")
        return ""


async def generate_weekly_report(complaints_data: list[dict], date_range: dict) -> dict:
    """Returns structured report dict with summary, trends, anomalies, recommendations."""
    prompt = f"""You are an HR analytics officer generating a weekly complaints report for Jabil manufacturing.

Period: {date_range.get('start')} to {date_range.get('end')}
Total complaints: {len(complaints_data)}

Complaints data (JSON):
{json.dumps(complaints_data[:50], indent=2)}

Generate a structured weekly report as JSON with these exact keys:
{{
  "summary": "2-3 sentence executive summary",
  "top_issues": [{{"department": str, "count": int, "top_complaint": str}}],
  "resolution_rate": float (0-100),
  "anomalies": ["list of unusual patterns detected"],
  "recommendations": ["list of 3-5 actionable recommendations"],
  "department_breakdown": [{{"name": str, "total": int, "resolved": int, "urgent": int}}]
}}

Respond ONLY with valid JSON."""

    try:
        resp = await get_claude().messages.create(
            model="claude-opus-4-6",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        return json.loads(resp.content[0].text)
    except Exception as e:
        logger.error(f"generate_weekly_report error: {e}")
        return {"summary": "Report generation failed.", "error": str(e)}


async def generate_root_cause(complaints_list: list[dict]) -> dict:
    """Returns root cause analysis with confidence %."""
    prompt = f"""Analyze these {len(complaints_list)} workplace complaints from Jabil manufacturing and identify root causes.

Data: {json.dumps(complaints_list[:30], indent=2)}

Return JSON:
{{
  "root_causes": [
    {{"cause": str, "confidence": int (0-100), "affected_departments": [str], "complaint_count": int}}
  ],
  "summary": str
}}"""

    try:
        resp = await get_claude().messages.create(
            model="claude-opus-4-6",
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}],
        )
        return json.loads(resp.content[0].text)
    except Exception as e:
        logger.error(f"generate_root_cause error: {e}")
        return {"root_causes": [], "summary": "Analysis unavailable"}


async def generate_forecast(historical_data: list[dict]) -> dict:
    """Returns 7-day ticket volume prediction."""
    prompt = f"""Based on this historical complaint data from Jabil manufacturing, predict the next 7 days of ticket volume.

Historical data (daily counts): {json.dumps(historical_data, indent=2)}

Return JSON:
{{
  "forecast": [{{"date": "YYYY-MM-DD", "predicted_count": int, "confidence": "low|medium|high"}}],
  "trend": "increasing|stable|decreasing",
  "insight": str
}}"""

    try:
        resp = await get_claude().messages.create(
            model="claude-opus-4-6",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        return json.loads(resp.content[0].text)
    except Exception as e:
        logger.error(f"generate_forecast error: {e}")
        return {"forecast": [], "trend": "stable", "insight": "Forecast unavailable"}
