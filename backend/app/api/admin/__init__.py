"""Admin API routes - protected by Cloudflare Access at network edge."""

from fastapi import APIRouter

from app.api.admin.locksmiths import router as locksmiths_router
from app.api.admin.jobs import router as jobs_router
from app.api.admin.sessions import router as sessions_router
from app.api.admin.messages import router as messages_router

router = APIRouter(prefix="/api/admin", tags=["admin"])

router.include_router(locksmiths_router)
router.include_router(jobs_router)
router.include_router(sessions_router)
router.include_router(messages_router)
