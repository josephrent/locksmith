"""Add price and request_session_id to job_offers

Revision ID: 004
Revises: 003
Create Date: 2026-01-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '004'
down_revision: Union[str, None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add request_session_id to job_offers
    op.add_column('job_offers', sa.Column('request_session_id', sa.UUID(), nullable=True))
    op.create_index(op.f('ix_job_offers_request_session_id'), 'job_offers', ['request_session_id'], unique=False)
    op.create_foreign_key('fk_job_offers_request_session_id', 'job_offers', 'request_sessions', ['request_session_id'], ['id'])
    
    # Add quoted_price to job_offers
    op.add_column('job_offers', sa.Column('quoted_price', sa.Integer(), nullable=True))
    
    # Make job_id nullable (to support offers before job creation)
    op.alter_column('job_offers', 'job_id', nullable=True)


def downgrade() -> None:
    # Make job_id not nullable again
    op.alter_column('job_offers', 'job_id', nullable=False)
    
    # Remove quoted_price
    op.drop_column('job_offers', 'quoted_price')
    
    # Remove request_session_id
    op.drop_constraint('fk_job_offers_request_session_id', 'job_offers', type_='foreignkey')
    op.drop_index(op.f('ix_job_offers_request_session_id'), table_name='job_offers')
    op.drop_column('job_offers', 'request_session_id')
