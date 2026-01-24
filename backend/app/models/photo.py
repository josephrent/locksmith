"""Photo model for storing uploaded images."""

import uuid
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Photo(Base):
    """
    Photo model for storing uploaded images.
    
    Photos can be linked to either a Job (after payment) or RequestSession (before payment).
    Supports both web uploads and Twilio MMS.
    """
    
    __tablename__ = "photos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    
    # Link to job or request session
    job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    request_session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("request_sessions.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    
    # Source of the photo
    source: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="web_upload",
    )  # "web_upload" or "twilio_mms"
    
    # S3 storage
    s3_bucket: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Note: s3_key removed - path is reconstructed from id + job_id/request_session_id
    
    # Metadata
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    
    # Twilio metadata (if from MMS)
    twilio_message_sid: Mapped[str | None] = mapped_column(String(100), nullable=True)
    twilio_media_sid: Mapped[str | None] = mapped_column(String(100), nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )
    
    # Relationships
    job = relationship("Job", back_populates="photos")
    request_session = relationship("RequestSession", back_populates="photos")

    def get_s3_key(self) -> str | None:
        """
        Reconstruct S3 key from Photo model.
        
        This method uses the Photo.id as the filename UUID and reconstructs
        the path based on whether the photo is linked to a job or session.
        
        Returns:
            S3 key string or None if bucket not configured
        """
        from app.config import get_settings
        from app.services.s3_service import S3Service
        
        settings = get_settings()
        if not settings.s3_bucket_name:
            return None
        
        s3_service = S3Service()
        return s3_service.get_s3_key(
            photo_id=self.id,
            session_id=self.request_session_id,
            job_id=self.job_id,
        )

    def __repr__(self) -> str:
        return f"<Photo {self.id} - {self.source}>"
