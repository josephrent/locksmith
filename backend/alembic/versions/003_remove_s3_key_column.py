"""Remove s3_key column from photos table

Revision ID: 003
Revises: 002
Create Date: 2026-01-23

S3 paths are now reconstructed from Photo.id + job_id/request_session_id
instead of storing the full path. This provides a single source of truth
for path construction logic.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Remove s3_key column - paths are now reconstructed from Photo.id
    op.drop_column('photos', 's3_key')


def downgrade() -> None:
    # Re-add s3_key column for rollback
    op.add_column('photos', sa.Column('s3_key', sa.String(500), nullable=True))
