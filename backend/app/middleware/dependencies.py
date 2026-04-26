from fastapi import Depends, HTTPException, Cookie, status
from jwt.exceptions import PyJWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User, UserRole
from app.services.auth_service import decode_token


async def get_current_user(
    access_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
    )
    if not access_token:
        raise credentials_exception
    try:
        payload = decode_token(access_token)
        if payload.get("type") != "access":
            raise credentials_exception
        user_id: int = int(payload["sub"])
    except (PyJWTError, KeyError, ValueError):
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def require_roles(*roles: UserRole):
    """Factory that returns a dependency enforcing one of the given roles."""
    async def guard(current_user=Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user
    return guard


# Convenience shortcuts
require_admin = require_roles(UserRole.admin, UserRole.superadmin)
require_superadmin = require_roles(UserRole.superadmin)
require_vendor = require_roles(UserRole.vendor)
