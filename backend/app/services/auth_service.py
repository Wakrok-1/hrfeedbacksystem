from datetime import datetime, timedelta, timezone
from typing import Any
import uuid
import jwt
import bcrypt
from app.config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


# Pre-computed hash used to equalize timing when a user lookup returns nothing.
# Running bcrypt on a dummy string prevents user-enumeration via response time.
_DUMMY_HASH = hash_password("dummy-timing-equalization-string-x7Kp!")


def dummy_password_check() -> None:
    """Call when user is not found to prevent timing-based user enumeration."""
    verify_password("not-the-real-password", _DUMMY_HASH)


def validate_password(password: str) -> None:
    """Raise ValueError if password doesn't meet minimum strength requirements."""
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    has_digit = any(c.isdigit() for c in password)
    has_special = any(not c.isalnum() for c in password)
    if not (has_digit or has_special):
        raise ValueError("Password must contain at least one number or special character")


def _create_token(data: dict[str, Any], expires_delta: timedelta) -> str:
    payload = {**data, "exp": datetime.now(timezone.utc) + expires_delta}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(user_id: int, role: str, token_version: int = 0) -> str:
    return _create_token(
        {
            "sub": str(user_id),
            "role": role,
            "type": "access",
            "ver": token_version,
            "jti": str(uuid.uuid4()),
        },
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(user_id: int, role: str, token_version: int = 0) -> str:
    return _create_token(
        {
            "sub": str(user_id),
            "role": role,
            "type": "refresh",
            "ver": token_version,
            "jti": str(uuid.uuid4()),
        },
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


def decode_token(token: str) -> dict[str, Any]:
    """Raises jwt.PyJWTError if invalid or expired."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
