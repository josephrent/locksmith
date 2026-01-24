"""Service for S3 file storage operations."""

from __future__ import annotations
import uuid
from datetime import timedelta
from uuid import UUID
import boto3
from botocore.exceptions import ClientError
from botocore.config import Config

from app.config import get_settings

settings = get_settings()


class S3Service:
    """Handles S3 uploads and presigned URL generation for photos."""

    def __init__(self):
        """Initialize S3 client."""
        if not settings.s3_bucket_name:
            self.client = None
            return

        # Configure S3 client
        config = Config(
            region_name=settings.aws_region,
            signature_version='v4',
        )

        if settings.aws_access_key_id and settings.aws_secret_access_key:
            # Use explicit credentials
            self.client = boto3.client(
                's3',
                aws_access_key_id=settings.aws_access_key_id,
                aws_secret_access_key=settings.aws_secret_access_key,
                config=config,
            )
        else:
            # Use default credentials (IAM role, environment, etc.)
            self.client = boto3.client('s3', config=config)

        self.bucket_name = settings.s3_bucket_name
        self.photo_prefix = settings.s3_photo_prefix

    def is_configured(self) -> bool:
        """Check if S3 is properly configured."""
        return self.client is not None and bool(self.bucket_name)

    def get_s3_key(
        self,
        photo_id: UUID,
        session_id: UUID | None = None,
        job_id: UUID | None = None,
    ) -> str:
        """
        Reconstruct S3 key from photo ID and context.
        
        This is the single source of truth for S3 path construction.
        
        Args:
            photo_id: The Photo.id (used as filename UUID)
            session_id: Request session ID (if photo is linked to session)
            job_id: Job ID (if photo is linked to job)
        
        Returns:
            S3 key string (e.g., "photos/sessions/{session_id}/{photo_id}.jpg")
        """
        filename = f"{photo_id}.jpg"
        
        if session_id:
            return f"{self.photo_prefix}sessions/{session_id}/{filename}"
        elif job_id:
            return f"{self.photo_prefix}jobs/{job_id}/{filename}"
        else:
            return f"{self.photo_prefix}{filename}"

    def upload_photo(
        self,
        photo_id: UUID,
        file_content: bytes,
        content_type: str,
        session_id: UUID | None = None,
        job_id: UUID | None = None,
    ) -> tuple[str, str]:
        """
        Upload photo to S3 using Photo.id as the filename UUID.
        
        Args:
            photo_id: The Photo.id to use as filename (must be generated before calling)
            file_content: The file bytes to upload
            content_type: MIME type of the file
            session_id: Request session ID (if photo is linked to session)
            job_id: Job ID (if photo is linked to job)
        
        Returns:
            tuple[str, str]: (bucket_name, s3_key)
        """
        if not self.is_configured():
            raise ValueError("S3 is not configured. Set AWS credentials and S3_BUCKET_NAME.")

        # Reconstruct S3 key using photo_id
        s3_key = self.get_s3_key(photo_id, session_id=session_id, job_id=job_id)

        # Upload to S3
        try:
            # Note: With "ACLs disabled" (bucket owner enforced) mode,
            # we don't need to set ACL. The bucket's "Block all public access"
            # setting ensures privacy. All objects are owned by the bucket owner.
            self.client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=file_content,
                ContentType=content_type,
                # Server-side encryption (SSE-S3)
                ServerSideEncryption='AES256',
            )
        except ClientError as e:
            raise ValueError(f"Failed to upload to S3: {str(e)}")

        return (self.bucket_name, s3_key)

    def get_presigned_url(
        self,
        s3_key: str,
        expiration: int = 300,  # 5 minutes default
    ) -> str:
        """
        Generate a presigned URL for viewing a photo.
        
        Args:
            s3_key: The S3 object key
            expiration: URL expiration time in seconds (default 5 minutes)
        
        Returns:
            Presigned URL string
        """
        if not self.is_configured():
            raise ValueError("S3 is not configured.")

        try:
            url = self.client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': s3_key,
                },
                ExpiresIn=expiration,
            )
            return url
        except ClientError as e:
            raise ValueError(f"Failed to generate presigned URL: {str(e)}")

    async def delete_photo(self, s3_key: str) -> bool:
        """
        Delete a photo from S3.
        
        Args:
            s3_key: The S3 object key to delete
        
        Returns:
            True if successful, False otherwise
        """
        if not self.is_configured():
            return False

        try:
            self.client.delete_object(
                Bucket=self.bucket_name,
                Key=s3_key,
            )
            return True
        except ClientError:
            return False
