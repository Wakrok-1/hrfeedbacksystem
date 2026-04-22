from fastapi import APIRouter, UploadFile, File, Depends
from app.services.storage_service import upload_files
from app.middleware.dependencies import get_current_user, require_vendor
from app.models.user import User

router = APIRouter(prefix="/api/upload", tags=["uploads"])


@router.post("/complaint")
async def upload_complaint_files(
    files: list[UploadFile] = File(...),
):
    """
    Public endpoint — no auth required.
    Called before submitting a complaint to get back file URLs.
    """
    uploaded = await upload_files(files, folder="complaints")
    return {
        "success": True,
        "data": uploaded,
        "message": f"{len(uploaded)} file(s) uploaded",
    }


@router.post("/vendor-response")
async def upload_vendor_response_files(
    files: list[UploadFile] = File(...),
    current_user: User = Depends(require_vendor),
):
    """Vendor-only. Upload solution photos for a vendor response."""
    uploaded = await upload_files(files, folder="vendor-responses")
    return {
        "success": True,
        "data": uploaded,
        "message": f"{len(uploaded)} file(s) uploaded",
    }
