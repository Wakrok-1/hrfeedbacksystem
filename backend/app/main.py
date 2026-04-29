import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import settings
from app.database import get_db
from app.routers import auth, complaints, tracking, uploads, admin, vendor, superadmin
from app.routers import analytics as analytics_router
from app.middleware.dependencies import get_current_user
from app.middleware.security import SecurityHeadersMiddleware, CSRFMiddleware
from app.schemas.auth import UserOut

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start APScheduler
    async def _anomaly_job():
        async for db in get_db():
            try:
                from app.routers.analytics import refresh_anomalies_job
                await refresh_anomalies_job(db)
            except Exception:
                pass

    scheduler.add_job(_anomaly_job, "interval", minutes=30, id="refresh_anomalies")
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="HR Integrated Feedback System", version="1.0.0", lifespan=lifespan)


@app.exception_handler(Exception)
async def _global_exc_handler(request: Request, exc: Exception):
    """Log the full traceback server-side and return a generic 500 to the client."""
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    origin = request.headers.get("origin", "")
    headers = {}
    if origin:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred. Please try again."},
        headers=headers,
    )

_cors_origins = {settings.FRONTEND_URL}
if settings.EXTRA_CORS_ORIGINS:
    _cors_origins.update(o.strip() for o in settings.EXTRA_CORS_ORIGINS.split(",") if o.strip())

# Middleware stack (last added = outermost = runs first on request):
#   CSRFMiddleware → SecurityHeadersMiddleware → CORSMiddleware → route handler
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(_cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CSRFMiddleware, allowed_origins=_cors_origins)

app.include_router(auth.router)
app.include_router(complaints.router)
app.include_router(tracking.router)
app.include_router(uploads.router)
app.include_router(admin.router)
app.include_router(vendor.router)
app.include_router(superadmin.router)
app.include_router(analytics_router.router)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/auth/me")
async def me(current_user=Depends(get_current_user)):
    return {
        "success": True,
        "data": UserOut.model_validate(current_user),
        "message": "",
    }
