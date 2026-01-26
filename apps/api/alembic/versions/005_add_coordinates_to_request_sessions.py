"""Add latitude and longitude to request_sessions

Revision ID: 005
Revises: 004
Create Date: 2026-01-25

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '005'
down_revision: Union[str, None] = '004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add coordinate fields to request_sessions table
    op.add_column('request_sessions', sa.Column('latitude', sa.Float(), nullable=True))
    op.add_column('request_sessions', sa.Column('longitude', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('request_sessions', 'longitude')
    op.drop_column('request_sessions', 'latitude')
