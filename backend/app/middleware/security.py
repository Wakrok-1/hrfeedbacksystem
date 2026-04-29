"""
Security middleware: rate limiting, CSRF protection, security headers.
"""
import asyncio
import time
import logging
from collections import defaultdict, deque
from typing import Callable
from fastapi import HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from app.config import settings

logger = logging.getLogger(__name__)


class _RateLimiter:
    """Async in-memory sliding window rate limiter. Single-instance safe."""

    def __init__(self, max_requests: int, window_seconds: int):
        self._max = max_requests
        self._window = window_seconds
        self._lock = asyncio.Lock()
        self._buckets: dict[str, deque[float]] = defaultdict(deque)

    async def check(self, key: str) -> bool:
        """Returns True if request is allowed, False if rate-limited."""
        now = time.monotonic()
        async with self._lock:
            dq = self._buckets[key]
            cutoff = now - self._window
            while dq and dq[0] < cutoff:
                dq.popleft()
            if len(dq) >= self._max:
                return False
            dq.append(now)
            return True


# 10 login attempts per minute per IP
_login_limiter = _RateLimiter(max_requests=10, window_seconds=60)
# 300 general API requests per minute per IP
_api_limiter = _RateLimiter(max_requests=300, window_seconds=60)


async def rate_limit_login(request: Request):
    ip = request.client.host if request.client else "unknown"
    if not await _login_limiter.check(ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please wait before trying again.",
        )


async def rate_limit_api(request: Request):
    ip = request.client.host if request.client else "unknown"
    if not await _api_limiter.check(ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please slow down.",
        )


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to every response."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if settings.IS_PRODUCTION:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


_CSRF_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


class CSRFMiddleware(BaseHTTPMiddleware):
    """
    Validate Origin header on state-mutating requests.
    Needed because SameSite=None cookies don't prevent CSRF on cross-origin deploys.
    """

    def __init__(self, app, allowed_origins: set[str]):
        super().__init__(app)
        self._allowed = allowed_origins

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.method not in _CSRF_SAFE_METHODS:
            origin = request.headers.get("origin")
            if origin and origin not in self._allowed:
                logger.warning("CSRF blocked: origin=%s path=%s", origin, request.url.path)
                return Response(
                    content='{"detail":"Forbidden: invalid origin"}',
                    status_code=403,
                    media_type="application/json",
                )
        return await call_next(request)
