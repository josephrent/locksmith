"""Dependency injection for API routes."""

from typing import Annotated
import redis.asyncio as redis
from fastapi import Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings, Settings
from app.database import get_db
from app.services.locksmith_service import LocksmithService
from app.services.job_service import JobService
from app.services.dispatch_service import DispatchService
from app.services.sms_service import SMSService
from app.services.payment_service import PaymentService
from app.services.audit_service import AuditService

settings = get_settings()

# Redis connection pool
redis_pool = redis.ConnectionPool.from_url(settings.redis_url, decode_responses=True)


async def get_redis() -> redis.Redis:
    """Get Redis client."""
    return redis.Redis(connection_pool=redis_pool)


def get_admin_email(
    cf_access_authenticated_user_email: str | None = Header(None, alias="Cf-Access-Authenticated-User-Email"),
) -> str | None:
    """
    Get admin email from Cloudflare Access header.
    
    This is for audit logging only, not authorization.
    Authorization happens at the network edge via Cloudflare Access.
    """
    return cf_access_authenticated_user_email


# Type aliases for dependency injection
DbSession = Annotated[AsyncSession, Depends(get_db)]
RedisClient = Annotated[redis.Redis, Depends(get_redis)]
AdminEmail = Annotated[str | None, Depends(get_admin_email)]
AppSettings = Annotated[Settings, Depends(get_settings)]


def get_audit_service(
    db: DbSession,
    admin_email: AdminEmail,
) -> AuditService:
    """Get audit service with admin context."""
    return AuditService(db, actor_email=admin_email)


def get_locksmith_service(db: DbSession) -> LocksmithService:
    """Get locksmith service."""
    return LocksmithService(db)


def get_job_service(db: DbSession) -> JobService:
    """Get job service."""
    return JobService(db)


def get_sms_service(db: DbSession) -> SMSService:
    """Get SMS service."""
    return SMSService(db)


def get_payment_service(
    db: DbSession,
    audit_service: AuditService = Depends(get_audit_service),
) -> PaymentService:
    """Get payment service."""
    return PaymentService(db, audit_service)


def get_dispatch_service(
    db: DbSession,
    redis_client: RedisClient,
    sms_service: SMSService = Depends(get_sms_service),
    audit_service: AuditService = Depends(get_audit_service),
) -> DispatchService:
    """Get dispatch service."""
    return DispatchService(db, redis_client, sms_service, audit_service)


# Annotated service dependencies
AuditServiceDep = Annotated[AuditService, Depends(get_audit_service)]
LocksmithServiceDep = Annotated[LocksmithService, Depends(get_locksmith_service)]
JobServiceDep = Annotated[JobService, Depends(get_job_service)]
SMSServiceDep = Annotated[SMSService, Depends(get_sms_service)]
PaymentServiceDep = Annotated[PaymentService, Depends(get_payment_service)]
DispatchServiceDep = Annotated[DispatchService, Depends(get_dispatch_service)]
