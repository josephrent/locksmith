"""Add photos table and car fields to jobs

Revision ID: 002
Revises: 001
Create Date: 2026-01-23

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add car fields to jobs table
    op.add_column('jobs', sa.Column('car_make', sa.String(100), nullable=True))
    op.add_column('jobs', sa.Column('car_model', sa.String(100), nullable=True))
    op.add_column('jobs', sa.Column('car_year', sa.Integer(), nullable=True))
    
    # Add car fields to request_sessions table
    op.add_column('request_sessions', sa.Column('car_make', sa.String(100), nullable=True))
    op.add_column('request_sessions', sa.Column('car_model', sa.String(100), nullable=True))
    op.add_column('request_sessions', sa.Column('car_year', sa.Integer(), nullable=True))
    
    # Create photos table
    op.create_table(
        'photos',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('job_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('jobs.id', ondelete='CASCADE'), nullable=True),
        sa.Column('request_session_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('request_sessions.id', ondelete='CASCADE'), nullable=True),
        sa.Column('source', sa.String(50), nullable=False, server_default='web_upload'),
        sa.Column('s3_bucket', sa.String(255), nullable=True),
        sa.Column('s3_key', sa.String(500), nullable=True),
        sa.Column('content_type', sa.String(100), nullable=True),
        sa.Column('bytes', sa.Integer(), nullable=True),
        sa.Column('twilio_message_sid', sa.String(100), nullable=True),
        sa.Column('twilio_media_sid', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_photos_job_id', 'photos', ['job_id'])
    op.create_index('ix_photos_request_session_id', 'photos', ['request_session_id'])


def downgrade() -> None:
    op.drop_index('ix_photos_request_session_id', table_name='photos')
    op.drop_index('ix_photos_job_id', table_name='photos')
    op.drop_table('photos')
    op.drop_column('request_sessions', 'car_year')
    op.drop_column('request_sessions', 'car_model')
    op.drop_column('request_sessions', 'car_make')
    op.drop_column('jobs', 'car_year')
    op.drop_column('jobs', 'car_model')
    op.drop_column('jobs', 'car_make')
