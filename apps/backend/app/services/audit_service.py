"""Service for audit logging."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_event import AuditEvent


class AuditService:
    """Handles audit event logging for all system operations."""

    def __init__(self, db: AsyncSession, actor_email: str | None = None):
        self.db = db
        self.actor_email = actor_email

    async def log_event(
        self,
        entity_type: str,
        entity_id: str,
        event_type: str,
        payload: dict | None = None,
        description: str | None = None,
        actor_type: str = "system",
    ) -> AuditEvent:
        """
        Log an audit event.
        
        Args:
            entity_type: Type of entity (job, locksmith, payment, etc.)
            entity_id: ID of the entity
            event_type: Type of event (created, updated, assigned, etc.)
            payload: Additional event data as JSON
            description: Human-readable description
            actor_type: Who performed the action (system, admin, locksmith)
        """
        event = AuditEvent(
            entity_type=entity_type,
            entity_id=entity_id,
            event_type=event_type,
            payload_json=payload,
            description=description,
            actor_email=self.actor_email,
            actor_type=actor_type,
        )

        self.db.add(event)
        await self.db.commit()
        await self.db.refresh(event)

        return event

    async def log_admin_action(
        self,
        entity_type: str,
        entity_id: str,
        action: str,
        payload: dict | None = None,
    ) -> AuditEvent:
        """Log an admin action with actor context."""
        return await self.log_event(
            entity_type=entity_type,
            entity_id=entity_id,
            event_type=f"admin_{action}",
            payload=payload,
            actor_type="admin",
        )
