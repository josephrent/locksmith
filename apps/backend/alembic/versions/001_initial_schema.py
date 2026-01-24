"""Initial schema

Revision ID: 001
Revises: 
Create Date: 2026-01-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create locksmiths table
    op.create_table(
        'locksmiths',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('display_name', sa.String(255), nullable=False),
        sa.Column('phone', sa.String(20), unique=True, nullable=False, index=True),
        sa.Column('primary_city', sa.String(100), nullable=False, index=True),
        sa.Column('supports_home_lockout', sa.Boolean(), default=False),
        sa.Column('supports_car_lockout', sa.Boolean(), default=False),
        sa.Column('supports_rekey', sa.Boolean(), default=False),
        sa.Column('supports_smart_lock', sa.Boolean(), default=False),
        sa.Column('is_active', sa.Boolean(), default=True, index=True),
        sa.Column('is_available', sa.Boolean(), default=True, index=True),
        sa.Column('typical_hours', sa.String(255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('onboarded_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )

    # Create request_sessions table
    op.create_table(
        'request_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('status', sa.String(50), nullable=False, index=True),
        sa.Column('customer_name', sa.String(255), nullable=True),
        sa.Column('customer_phone', sa.String(20), nullable=True, index=True),
        sa.Column('customer_email', sa.String(255), nullable=True),
        sa.Column('address', sa.String(500), nullable=True),
        sa.Column('city', sa.String(100), nullable=True),
        sa.Column('is_in_service_area', sa.Boolean(), nullable=True),
        sa.Column('service_type', sa.String(50), nullable=True),
        sa.Column('urgency', sa.String(50), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('deposit_amount', sa.Integer(), nullable=True),
        sa.Column('stripe_payment_intent_id', sa.String(255), nullable=True),
        sa.Column('step_reached', sa.Integer(), default=1),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('ip_address', sa.String(50), nullable=True),
        sa.Column('referrer', sa.String(500), nullable=True),
        sa.Column('utm_params', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    )

    # Create jobs table
    op.create_table(
        'jobs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('customer_name', sa.String(255), nullable=False),
        sa.Column('customer_phone', sa.String(20), nullable=False, index=True),
        sa.Column('service_type', sa.String(50), nullable=False, index=True),
        sa.Column('urgency', sa.String(50), default='standard'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('address', sa.String(500), nullable=False),
        sa.Column('city', sa.String(100), nullable=False, index=True),
        sa.Column('latitude', sa.Numeric(10, 7), nullable=True),
        sa.Column('longitude', sa.Numeric(10, 7), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, index=True),
        sa.Column('deposit_amount', sa.Integer(), nullable=False),
        sa.Column('stripe_payment_intent_id', sa.String(255), nullable=True),
        sa.Column('stripe_payment_status', sa.String(50), nullable=True),
        sa.Column('refund_amount', sa.Integer(), nullable=True),
        sa.Column('stripe_refund_id', sa.String(255), nullable=True),
        sa.Column('assigned_locksmith_id', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('locksmiths.id'), nullable=True),
        sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('current_wave', sa.Integer(), default=0),
        sa.Column('dispatch_started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('request_session_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('request_sessions.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    )

    # Create job_offers table
    op.create_table(
        'job_offers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('job_id', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('jobs.id'), nullable=False, index=True),
        sa.Column('locksmith_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('locksmiths.id'), nullable=False, index=True),
        sa.Column('wave_number', sa.Integer(), nullable=False, default=1),
        sa.Column('status', sa.String(50), nullable=False, index=True),
        sa.Column('twilio_message_sid', sa.String(50), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('responded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
    )

    # Create messages table
    op.create_table(
        'messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('job_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('jobs.id'), nullable=True, index=True),
        sa.Column('locksmith_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('locksmiths.id'), nullable=True, index=True),
        sa.Column('direction', sa.String(20), nullable=False, index=True),
        sa.Column('to_phone', sa.String(20), nullable=False),
        sa.Column('from_phone', sa.String(20), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('provider_message_id', sa.String(50), nullable=True),
        sa.Column('delivery_status', sa.String(50), nullable=True),
        sa.Column('error_code', sa.String(20), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )

    # Create audit_events table
    op.create_table(
        'audit_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('entity_type', sa.String(50), nullable=False, index=True),
        sa.Column('entity_id', sa.String(50), nullable=False, index=True),
        sa.Column('event_type', sa.String(100), nullable=False, index=True),
        sa.Column('actor_email', sa.String(255), nullable=True, index=True),
        sa.Column('actor_type', sa.String(50), default='system'),
        sa.Column('payload_json', postgresql.JSONB(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, index=True),
    )


def downgrade() -> None:
    op.drop_table('audit_events')
    op.drop_table('messages')
    op.drop_table('job_offers')
    op.drop_table('jobs')
    op.drop_table('request_sessions')
    op.drop_table('locksmiths')
