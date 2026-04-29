"""
File storage via Supabase Storage (free, no credit card).

If SUPABASE_SERVICE_KEY is not set, falls back to local disk so dev
environments work without any config.

Public functions:
  upload_files(files, folder)  → list[dict]   (used by upload router)
  upload_file(bytes, filename, content_type, folder) → str (public URL)
  delete_file(file_url)        → None          (fails silently)

Bucket layout:
  hr-feedback/
    complaints/        ← employee attachments
    vendor-responses/  ← vendor attachments
"""
import uuid
import logging
from pathlib import Path
import httpx
from fastapi import UploadFile, HTTPException, status
from app.config import settings

logger = logging.getLogger(__name__)

ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "video/mp4", "video/quicktime",
    "application/pdf",
}
# Explicitly rejected — some browsers may send these for renamed files
_REJECTED_TYPES = {"image/svg+xml", "text/html", "text/javascript", "application/javascript", "application/x-php"}
MAX_FILE_MB = 20
MAX_TOTAL_MB = 60
MAX_FILES = 5
MIN_FILES = 1

EXT_MAP = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "application/pdf": "pdf",
}

# Magic byte signatures for content validation. None = skip check (complex/variable format).
_MAGIC: dict[str, bytes | None] = {
    "image/jpeg": b"\xff\xd8\xff",
    "image/png": b"\x89PNG\r\n\x1a\n",
    "image/gif": b"GIF8",
    "image/webp": b"RIFF",
    "application/pdf": b"%PDF",
    "video/mp4": None,
    "video/quicktime": None,
}


def _magic_ok(content_type: str, data: bytes) -> bool:
    sig = _MAGIC.get(content_type)
    if sig is None:
        return True
    return data[:len(sig)] == sig


def _supabase_ready() -> bool:
    return bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY)


# ── Core upload ───────────────────────────────────────────────────────────────

async def upload_file(file_bytes: bytes, original_filename: str, content_type: str, folder: str) -> str:
    """
    Upload raw bytes to Supabase Storage (or local disk as fallback).
    Returns the public URL string.
    """
    ext = EXT_MAP.get(content_type, "bin")
    key = f"{folder}/{uuid.uuid4()}.{ext}"
    bucket = settings.SUPABASE_STORAGE_BUCKET

    if _supabase_ready():
        upload_url = f"{settings.SUPABASE_URL}/storage/v1/object/{bucket}/{key}"
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(
                    upload_url,
                    content=file_bytes,
                    headers={
                        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                        "Content-Type": content_type,
                    },
                )
                r.raise_for_status()
            return f"{settings.SUPABASE_URL}/storage/v1/object/public/{bucket}/{key}"
        except httpx.HTTPStatusError as e:
            logger.error(f"Supabase upload failed for {key}: {e.response.status_code} {e.response.text}")
            raise HTTPException(status_code=500, detail="File upload failed")
        except Exception as e:
            logger.error(f"Supabase upload error for {key}: {e}")
            raise HTTPException(status_code=500, detail="File upload failed")

    # ── Local disk fallback (dev only) ────────────────────────────────────
    dest = Path("uploads") / folder
    dest.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4()}.{ext}"
    (dest / filename).write_bytes(file_bytes)
    return f"http://localhost:8000/uploads/{folder}/{filename}"


async def delete_file(file_url: str) -> None:
    """
    Delete a file from Supabase Storage by its public URL.
    Fails silently — never raises.
    """
    if not _supabase_ready() or not file_url:
        return
    try:
        bucket = settings.SUPABASE_STORAGE_BUCKET
        marker = f"/object/public/{bucket}/"
        if marker not in file_url:
            return
        key = file_url.split(marker, 1)[1]
        delete_url = f"{settings.SUPABASE_URL}/storage/v1/object/{bucket}"
        async with httpx.AsyncClient(timeout=10) as client:
            await client.delete(
                delete_url,
                json={"prefixes": [key]},
                headers={"Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}"},
            )
    except Exception as e:
        logger.error(f"Supabase delete failed for {file_url}: {e}")


# ── Bulk upload (used by upload router) ───────────────────────────────────────

async def upload_files(files: list[UploadFile], folder: str) -> list[dict]:
    if len(files) < MIN_FILES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least 1 file is required")
    if len(files) > MAX_FILES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Maximum {MAX_FILES} files allowed")

    results = []
    total_mb = 0.0

    for file in files:
        ct = file.content_type or ""
        if ct in _REJECTED_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type '{ct}' is not permitted.",
            )
        if ct not in ALLOWED_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type not allowed. Use JPG, PNG, GIF, WebP, MP4, MOV, or PDF.",
            )

        contents = await file.read()

        # Validate actual file content against the declared MIME type
        if not _magic_ok(ct, contents):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{file.filename}: file content does not match declared type.",
            )

        size_mb = len(contents) / (1024 * 1024)

        if size_mb > MAX_FILE_MB:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{file.filename} exceeds {MAX_FILE_MB}MB limit ({size_mb:.1f}MB)",
            )

        total_mb += size_mb
        if total_mb > MAX_TOTAL_MB:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Total upload size exceeds {MAX_TOTAL_MB}MB limit",
            )

        file_url = await upload_file(contents, file.filename or "upload", ct, folder)
        results.append({
            "file_name": file.filename,
            "file_url": file_url,
            "file_type": ct,
            "file_size_mb": round(size_mb, 3),
        })

    return results
