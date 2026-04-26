from fastapi import APIRouter, Depends, HTTPException, Response, Cookie, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jwt.exceptions import PyJWTError
from datetime import datetime

from app.database import get_db
from app.models.user import User
from app.models.tracking import VendorDeviceToken
from app.schemas.auth import LoginRequest, TokenResponse, UserOut
from app.services.auth_service import (
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

_ACCESS_COOKIE = "access_token"
_REFRESH_COOKIE = "refresh_token"


def _cookie_flags() -> tuple[bool, str]:
    """Returns (secure, samesite) based on environment."""
    return settings.IS_PRODUCTION, ("none" if settings.IS_PRODUCTION else "lax")


def _set_auth_cookies(response: Response, user_id: int, role: str) -> None:
    access_token = create_access_token(user_id, role)
    refresh_token = create_refresh_token(user_id, role)
    secure, samesite = _cookie_flags()

    response.set_cookie(
        key=_ACCESS_COOKIE,
        value=access_token,
        httponly=True,
        secure=secure,
        samesite=samesite,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key=_REFRESH_COOKIE,
        value=refresh_token,
        httponly=True,
        secure=secure,
        samesite=samesite,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )


@router.post("/login")
async def login(
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    # Vendors log in with phone; admins/superadmins log in with email
    if body.role == "vendor":
        result = await db.execute(select(User).where(User.phone == body.identifier))
        error_detail = "Invalid phone number or password"
    else:
        result = await db.execute(select(User).where(User.email == body.identifier))
        error_detail = "Invalid email or password"

    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=error_detail)
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    # Verify the user's actual role matches what was requested
    if body.role == "vendor" and user.role.value != "vendor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if body.role in ("admin", "superadmin") and user.role.value == "vendor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    _set_auth_cookies(response, user.id, user.role.value)

    # Vendor gets a 30-day trusted device token stored in DB + cookie
    if user.role.value == "vendor":
        device_token = VendorDeviceToken.generate(user.id)
        db.add(device_token)
        await db.commit()
        secure, samesite = _cookie_flags()
        response.set_cookie(
            key="vendor_device_token",
            value=device_token.token,
            httponly=True,
            secure=secure,
            samesite=samesite,
            max_age=30 * 86400,
        )

    return {
        "success": True,
        "data": UserOut.model_validate(user),
        "message": "Login successful",
    }


@router.post("/refresh")
async def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token",
    )
    if not refresh_token:
        raise credentials_exception
    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise credentials_exception
        user_id = int(payload["sub"])
    except (PyJWTError, KeyError, ValueError):
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise credentials_exception

    _set_auth_cookies(response, user.id, user.role.value)
    return {"success": True, "data": None, "message": "Token refreshed"}


@router.post("/logout")
async def logout(response: Response):
    secure, samesite = _cookie_flags()
    response.delete_cookie(_ACCESS_COOKIE, httponly=True, secure=secure, samesite=samesite)
    response.delete_cookie(_REFRESH_COOKIE, httponly=True, secure=secure, samesite=samesite)
    return {"success": True, "data": None, "message": "Logged out"}
