from fastapi import APIRouter, Depends, HTTPException, Response, Cookie, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jwt.exceptions import PyJWTError
from datetime import datetime, timedelta, timezone

from app.database import get_db
from app.models.user import User
from app.models.tracking import VendorDeviceToken
from app.schemas.auth import LoginRequest, TokenResponse, UserOut
from app.services.auth_service import (
    verify_password,
    dummy_password_check,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.middleware.security import rate_limit_login
from app.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

_ACCESS_COOKIE = "access_token"
_REFRESH_COOKIE = "refresh_token"

MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 1


def _cookie_flags() -> tuple[bool, str]:
    """Returns (secure, samesite) based on environment."""
    return settings.IS_PRODUCTION, ("none" if settings.IS_PRODUCTION else "lax")


def _set_auth_cookies(response: Response, user_id: int, role: str, token_version: int = 0) -> None:
    access_token = create_access_token(user_id, role, token_version)
    refresh_token = create_refresh_token(user_id, role, token_version)
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
    _rate: None = Depends(rate_limit_login),
):
    # Vendors log in with phone; admins/superadmins log in with email
    if body.role == "vendor":
        result = await db.execute(select(User).where(User.phone == body.identifier))
        error_detail = "Invalid phone number or password"
    else:
        result = await db.execute(select(User).where(User.email == body.identifier))
        error_detail = "Invalid email or password"

    user = result.scalar_one_or_none()

    # Always run bcrypt regardless of whether user exists — prevents timing-based enumeration
    if not user:
        dummy_password_check()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=error_detail)

    now_utc = datetime.now(timezone.utc)

    # Account lockout check
    if user.locked_until and user.locked_until > now_utc:
        remaining = int((user.locked_until - now_utc).total_seconds() / 60) + 1
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Account locked. Try again in {remaining} minute(s).",
        )

    if not verify_password(body.password, user.password_hash):
        user.login_attempts += 1
        if user.login_attempts >= MAX_LOGIN_ATTEMPTS:
            user.locked_until = now_utc + timedelta(minutes=LOCKOUT_MINUTES)
        await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=error_detail)

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    # Verify the user's actual role matches what was requested
    if body.role == "vendor" and user.role.value != "vendor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if body.role in ("admin", "superadmin") and user.role.value == "vendor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Successful login — reset lockout counters
    if user.login_attempts > 0 or user.locked_until is not None:
        user.login_attempts = 0
        user.locked_until = None

    _set_auth_cookies(response, user.id, user.role.value, user.token_version)

    # Vendor gets a 30-day trusted device token stored in DB + cookie
    vendor_device_token_value: str | None = None
    if user.role.value == "vendor":
        device_token = VendorDeviceToken.generate(user.id)
        db.add(device_token)
        vendor_device_token_value = device_token.token

    await db.commit()

    if vendor_device_token_value:
        secure, samesite = _cookie_flags()
        response.set_cookie(
            key="vendor_device_token",
            value=vendor_device_token_value,
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
        stored_ver = int(payload.get("ver", 0))
    except (PyJWTError, KeyError, ValueError):
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise credentials_exception

    # Reject refresh tokens issued before the last logout
    if stored_ver != user.token_version:
        raise credentials_exception

    _set_auth_cookies(response, user.id, user.role.value, user.token_version)
    return {"success": True, "data": None, "message": "Token refreshed"}


@router.post("/logout")
async def logout(
    response: Response,
    access_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
):
    # Increment token_version to invalidate all previously issued tokens
    if access_token:
        try:
            payload = decode_token(access_token)
            user_id = int(payload["sub"])
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if user:
                user.token_version += 1
                await db.commit()
        except Exception:
            pass  # expired or tampered token — still clear cookies

    secure, samesite = _cookie_flags()
    response.delete_cookie(_ACCESS_COOKIE, httponly=True, secure=secure, samesite=samesite)
    response.delete_cookie(_REFRESH_COOKIE, httponly=True, secure=secure, samesite=samesite)
    return {"success": True, "data": None, "message": "Logged out"}
